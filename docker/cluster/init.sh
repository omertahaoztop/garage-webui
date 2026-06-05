#!/usr/bin/env bash
# Initialize 3-node Garage cluster: layout assign + apply, create test key/bucket.
# Idempotent — tekrar çalıştırılabilir, mevcut layout'u varsa atlar.
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.cluster.yml}"
ADMIN_TOKEN="${ADMIN_TOKEN:-garagewebui-dev-admin-token-DO-NOT-USE-IN-PROD}"

# Repo root'a in (script docker/cluster/ altında)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

log()  { printf "\033[1;34m[init]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[warn]\033[0m %s\n" "$*" >&2; }
die()  { printf "\033[1;31m[err ]\033[0m %s\n" "$*" >&2; exit 1; }

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }
gnode()   { local node="$1"; shift; compose exec -T "$node" /garage "$@"; }

# 1) Cluster servislerinin healthy olmasını bekle
log "Waiting for garage1/2/3 to become healthy..."
for i in $(seq 1 60); do
  status1=$(docker inspect --format='{{.State.Health.Status}}' garage-cluster-node1 2>/dev/null || echo missing)
  status2=$(docker inspect --format='{{.State.Health.Status}}' garage-cluster-node2 2>/dev/null || echo missing)
  status3=$(docker inspect --format='{{.State.Health.Status}}' garage-cluster-node3 2>/dev/null || echo missing)
  if [[ "$status1" == "healthy" && "$status2" == "healthy" && "$status3" == "healthy" ]]; then
    log "All 3 nodes healthy."
    break
  fi
  if (( i % 10 == 0 )); then
    log "still waiting... node1=$status1 node2=$status2 node3=$status3"
  fi
  sleep 2
  if (( i == 60 )); then die "Timeout waiting for nodes to be healthy."; fi
done

# 2) Cluster'a peer ekle (her node, diğer iki node'u tanısın)
log "Connecting nodes to each other..."
# Önce her node'un kendi node ID'sini öğren
nid1=$(gnode garage1 node id -q 2>/dev/null | head -1 | tr -d '\r')
nid2=$(gnode garage2 node id -q 2>/dev/null | head -1 | tr -d '\r')
nid3=$(gnode garage3 node id -q 2>/dev/null | head -1 | tr -d '\r')

[[ -n "$nid1" ]] || die "Could not read garage1 node id"
[[ -n "$nid2" ]] || die "Could not read garage2 node id"
[[ -n "$nid3" ]] || die "Could not read garage3 node id"

log "node1 id: $nid1"
log "node2 id: $nid2"
log "node3 id: $nid3"

# Kısa ID = pubkey'in ilk 16 hex karakteri (layout assign için kullanılır)
# Garage layout/status komutları kısa formatı ister; node connect ise full <pubkey>@<host:port>
sid1="${nid1%%@*}"; sid1="${sid1:0:16}"
sid2="${nid2%%@*}"; sid2="${sid2:0:16}"
sid3="${nid3%%@*}"; sid3="${sid3:0:16}"
log "short ids: $sid1 / $sid2 / $sid3"

# 'garage node id' zaten <pubkey>@<rpc_public_addr> formatı döndürüyor.
gnode garage1 node connect "$nid2" || warn "garage1 → garage2 connect non-zero (zaten bağlı olabilir)"
gnode garage1 node connect "$nid3" || warn "garage1 → garage3 connect non-zero (zaten bağlı olabilir)"
gnode garage2 node connect "$nid3" || warn "garage2 → garage3 connect non-zero (zaten bağlı olabilir)"

# 3) 'garage status' içinde HEALTHY NODES tablosunda 3 satır görene kadar bekle
log "Waiting for nodes to discover each other..."
for i in $(seq 1 30); do
  out=$(gnode garage1 status 2>/dev/null || true)
  # HEALTHY NODES başlık satırından sonra gelen ve 16-hex ID ile başlayan satırları say
  known_count=$(printf '%s\n' "$out" | awk '/==== HEALTHY NODES ====/{flag=1; next} /====/{flag=0} flag && /^[0-9a-f]{16}/{c++} END{print c+0}')
  if (( known_count >= 3 )); then
    log "Cluster sees 3 healthy peers."
    break
  fi
  sleep 2
  if (( i == 30 )); then
    warn "Cluster did not converge to 3 HEALTHY peers (saw $known_count). Continuing anyway."
  fi
done

# 4) Layout zaten apply edilmiş mi kontrol et — etmemişse assign + apply
layout_show=$(gnode garage1 layout show 2>/dev/null || true)
if printf '%s\n' "$layout_show" | grep -q "No nodes currently have a role"; then
  log "No layout yet, will assign."
else
  # Apply edilmiş bir layout var, role'ü olan node sayısını say
  active_partitions=$(printf '%s\n' "$layout_show" | awk '/^[0-9a-f]{16}/{c++} END{print c+0}')
  if (( active_partitions >= 3 )); then
    log "Layout already applied (active nodes: $active_partitions). Skipping assignment."
    SKIP_LAYOUT=1
  fi
fi

if [[ -z "${SKIP_LAYOUT:-}" ]]; then
  log "Assigning layout: zone=dc1/dc2/dc3, capacity=1G each"
  # Garage v0.9+ syntax: kısa ID, capacity birimi açık (G/M/K), zone -z, capacity -c
  gnode garage1 layout assign -z dc1 -c 1G "$sid1"
  gnode garage1 layout assign -z dc2 -c 1G "$sid2"
  gnode garage1 layout assign -z dc3 -c 1G "$sid3"

  log "Showing pending layout..."
  gnode garage1 layout show

  log "Applying layout (version 1)..."
  gnode garage1 layout apply --version 1
fi

# 5) Cluster sağlığını doğrula
log "Cluster status:"
gnode garage1 status

# 6) Test bucket + access key oluştur (idempotent)
TEST_BUCKET="${TEST_BUCKET:-webui-test}"
TEST_KEY_NAME="${TEST_KEY_NAME:-webui-dev-key}"

log "Ensuring bucket '$TEST_BUCKET' exists..."
gnode garage1 bucket create "$TEST_BUCKET" 2>&1 | grep -v "already exists" || true

log "Ensuring key '$TEST_KEY_NAME' exists..."
key_create_out=$(gnode garage1 key create "$TEST_KEY_NAME" 2>&1 || true)
if printf '%s\n' "$key_create_out" | grep -q "already exists"; then
  log "Key already exists, looking up..."
  key_info=$(gnode garage1 key info "$TEST_KEY_NAME" --show-secret 2>/dev/null || true)
else
  key_info="$key_create_out"
fi

# Bucket'a okuma+yazma yetkisi ver
log "Granting read+write+owner on '$TEST_BUCKET' to '$TEST_KEY_NAME'..."
gnode garage1 bucket allow --read --write --owner "$TEST_BUCKET" --key "$TEST_KEY_NAME" || warn "bucket allow non-zero"

# 7) Access key bilgilerini ekrana bas
log "Test bucket + key ready. Key info:"
gnode garage1 key info "$TEST_KEY_NAME" --show-secret || true

cat <<'EOF'

================================================================
  Garage 3-node cluster READY
================================================================
  Admin endpoints:
    node1: http://localhost:3931  (token: garagewebui-dev-admin-token-DO-NOT-USE-IN-PROD)
    node2: http://localhost:3932
    node3: http://localhost:3933

  S3 endpoints:
    node1: http://localhost:3911   (region: garage)
    node2: http://localhost:3912
    node3: http://localhost:3913

  Garage Web UI:
    http://localhost:3909

  Quick smoke tests:
    curl -H "Authorization: Bearer garagewebui-dev-admin-token-DO-NOT-USE-IN-PROD" \
         http://localhost:3931/v2/GetClusterStatus | jq .
    curl -H "Authorization: Bearer garagewebui-dev-admin-token-DO-NOT-USE-IN-PROD" \
         http://localhost:3931/v2/GetClusterHealth | jq .

  Tear down:
    docker compose -f docker-compose.cluster.yml down -v
================================================================
EOF
