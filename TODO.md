# Garage Web UI — Roadmap

> **Hedef Garage versiyonu**: v2.3.0+ (yeni `/v2/<Operation>` admin API)
> **Diferansiyasyon**: Multi-cluster + OIDC + ops-grade forensic + MinIO Console-tarzı object browser
> **Resmi UI ile ilişki**: `Deuxfleurs/garage-webadmin` (Vue, tek-cluster, eninde sonunda Garage binary'siyle bundle) — biz kurumsal/multi-cluster boşluğunu doldurursak.

## İlkeler

1. **Single binary** (Go backend + embedded React UI). Düşük overhead.
2. **Geriye uyumlu env-var config** (tek-cluster mod default). Multi-cluster yalnızca `CLUSTERS_CONFIG=path.yaml` ile aktif.
3. **bcrypt + OIDC dual auth** (kullanıcı seçer; OIDC config'de aktifse her ikisi de görünür).
4. **Polling-based monitoring** — Garage'de event stream / SSE / WebSocket yok.
5. **Tüm admin çağrıları `/v2/*`** — `/v1/*` deprecated.
6. **Garage'da olmayan S3 özelliklerini UI'a koyma** — kullanıcıya yanlış sinyal vermez.

## Mevcut (✅ Tamamlanmış)

- [x] Cluster health monitoring (basic)
- [x] Layout management (basic)
- [x] Bucket CRUD + view + tabs (overview/browse/permissions)
- [x] Access key CRUD + per-bucket assign
- [x] Object browser (basic) + search input
- [x] bcrypt authentication
- [x] `garage.toml` auto-detect
- [x] Build system: Makefile + `gen_password` tool
- [x] BASE_PATH subpath support

---

## Faz 1 — Garage v2.3 Admin Parity + OIDC + Multi-Cluster + Browser Parity (4-5 hafta)

### Sprint 1: Foundation (Hafta 1)

#### Dokümantasyon
- [x] Bu TODO.md'yi yeni hedeflerle yeniden yaz
- [x] README'ye "Hedef Garage v2.3+" notu ekle
- [x] CHANGELOG başlat (conventional commits)
- [ ] CHANGELOG başlat (conventional commits + release-please)

#### Multi-cluster foundation (env-var primary + opsiyonel YAML)
- [x] `utils/Garage` client'ı **per-request cluster context** alacak şekilde refactor (singleton'dan vazgeç)
- [x] Cluster registry yükleme önceliği:
  1. `CLUSTERS_CONFIG=path/to/clusters.yaml` set ise → YAML'dan yükle (multi-cluster)
  2. Yoksa → mevcut env var'lar (`API_BASE_URL`, `API_ADMIN_KEY`, `S3_ENDPOINT_URL`, `S3_REGION`) (tek-cluster, geriye uyumlu)
- [x] YAML şeması:
  ```yaml
  clusters:
    - id: prod-dc1
      name: "Production DC1 (Istanbul)"
      admin_api_url: http://garage-dc1:3903
      admin_token_env: GARAGE_DC1_TOKEN
      s3_endpoint: http://garage-dc1:3900
      s3_region: garage
    - id: prod-dc2
      name: "Production DC2 (Ankara)"
      ...
  ```
- [x] `/api/clusters` endpoint: list (token mask), test-connection
- [x] Frontend: sidebar üstüne **cluster switcher** dropdown
- [x] Zustand store: `useActiveCluster()`
- [x] Tüm API call'lar `X-Cluster-Id` header gönderir

#### v2 endpoint audit
- [x] Mevcut backend çağrıları `/v2/<Operation>` formatında (audit yapıldı)
- [x] Tüm `/v1/*` path'leri `/v2/<Operation>` formatına geçirildi
- [ ] Garage v2.3 OpenAPI spec'inden TypeScript types generate et (`openapi-typescript`)
- [ ] Build script'e `make gen-types` target'ı ekle

### Sprint 2: OIDC + Admin Tokens (Hafta 2)

#### OIDC backend
- [x] `coreos/go-oidc/v3` + `golang.org/x/oauth2` ekle
- [x] `utils/oidc.go` + `router/oidc_auth.go` — provider discovery, callback, ID token validation
- [x] Routes (login/callback/status)
  - `GET /api/auth/oidc/login` — IdP redirect
  - `GET /api/auth/oidc/callback` — code exchange, session create
- [x] Login akışı (claims → group → scope mapping → session)
  1. OIDC OK → ID token claims al
  2. Claims'ten group → cluster + permission scope türet (config-driven mapping)
  3. Garage'de kullanıcı session'ı için `POST /v2/CreateAdminToken` (scope = türetilen)
  4. Secret session'a yaz
- [ ] Logout: `POST /v2/DeleteAdminToken` cleanup (session dinamik token üretmiyor — gereksiz olabilir)

#### OIDC config (config-driven mapping)
- [x] `OIDC_CONFIG` YAML (schema/oidc.go):
  ```yaml
  oidc:
    enabled: true
    issuer: https://auth.example.com
    client_id: garage-webui
    client_secret_env: OIDC_CLIENT_SECRET
    redirect_url: https://garage-ui.example.com/api/auth/oidc/callback
    scopes: [openid, email, groups]
    group_claim: groups
    mappings:
      - group: garage-admins
        clusters: ["*"]
        permissions: ["read", "write", "owner"]
      - group: garage-readers
        clusters: ["prod-dc1"]
        permissions: ["read"]
  ```

#### Auth UI (bcrypt + OIDC)
- [x] OIDC config aktifse Login sayfasında "Sign in with SSO" butonu göster
- [x] Username/password formu da kalsın (break-glass admin için)
- [x] OIDC disabled ise sadece bcrypt göster

#### Admin Tokens UI (Faz 1 öne çıkan diferansiyasyon)
- [x] Backend route'ları (`/api/admin-tokens/*`): List/Create/Update/Delete/Current
  - `ListAdminTokens`
  - `CreateAdminToken` (scope + expiry)
  - `UpdateAdminToken` (rename, change scope/expiry)
  - `DeleteAdminToken`
  - `GetCurrentAdminTokenInfo` (whoami)
- [x] Frontend: `pages/admin-tokens/page.tsx` (list + create dialog + delete + secret reveal)
  - List view (name, scope summary, expiry, created-at)
  - Create dialog: scope picker (cluster + bucket whitelist + perm flags), expiry (never / 7d / 30d / 90d / custom date)
  - Delete confirmation
- [x] Header'da current scope badge (`GetCurrentAdminTokenInfo`)

### Sprint 3: Object Browser Hardening — MinIO Console UX parity (Hafta 3)

> **Hedef**: MinIO Console v1.7.x browser deneyimini Garage'a yeniden inşa et. Kod kopyalama YOK (AGPL); sadece UX patern'leri.

#### Upload paterni
- [x] Drag & drop file/folder upload
- [x] Multi-file upload kuyruğu (Zustand transfer-store)
- [x] Per-file progress indicator
- [x] Multipart upload (büyük dosyalar)
- [x] Abort desteği
- [x] Folder upload

#### Browse paterni
- [ ] `react-window` virtualization (büyük listelerde) — eksik
- [ ] Server-side pagination (`continuation-token`) — eksik
- [x] Multi-select (checkbox column)
- [x] Bulk delete
- [ ] Bulk download as ZIP — eksik
- [x] Filter: date range, size, extension
- [x] Breadcrumbs + jump-to-prefix

#### Object operations
- [x] Folder create UI
- [x] Object copy
- [x] Object move
- [x] Object metadata viewer (preview drawer)
- [x] Presigned URL generator
- [x] File preview drawer (image/pdf/markdown/text/audio/video/hex)
  - Image (native `<img>`)
  - PDF (`react-pdf`)
  - Markdown (`react-markdown`)
  - Plain text (max ~1MB inline)
  - Audio/video (native `<audio>`/`<video>` + range request)

#### Anonymous share viewer
- [x] `/share/<token>` route (anonim, HMAC token)
- [x] Expiry hata mesajı

### Sprint 4: Cluster Operations (Hafta 4)

#### Layout staging editor
- [x] `pages/cluster/layout/page.tsx` — Current / Staged / Preview
- [x] Node editor row (zone/capacity/tags inline edit + stage/remove)
- [x] Workflow buttons (Preview / Apply / Revert):
  - `Stage Change` (`UpdateClusterLayout`)
  - `Preview Diff` (`PreviewClusterLayoutChanges`) — what-if calculator
  - `Apply` (`ApplyClusterLayout`, version+1 input + onay)
  - `Revert` (`RevertClusterLayout`)
- [x] Layout history timeline
- [x] `ClusterLayoutSkipDeadNodes` UI (danger zone + type-to-confirm modal)

#### Workers
- [x] `pages/workers/page.tsx` — ListWorkers (busy/error filtre)
- [x] Worker variable get/set
- [x] Tuning preset'leri

#### Block Errors
- [x] `pages/blocks/page.tsx` — ListBlockErrors table
- [x] Per-block detail drawer (GetBlockInfo)
- [x] RetryBlockResync
- [x] PurgeBlocks (type-to-confirm DELETE)
  - 2-step confirmation (etkilenen object/version listesi göster)
  - "DELETE" type-to-confirm
  - Bold warning: "Etkilenen object'ler kalıcı olarak silinecek"

### Sprint 5: Snapshots + Inspector + Dashboard + Tests (Hafta 5)

#### Snapshots
- [x] Snapshots — CreateMetadataSnapshot (single/all nodes), dashboard card
- [ ] (Opsiyonel ileri özellik) Cron-style scheduler — UI tarafında schedule sakla, Go backend job runner çağırır

#### Object Inspector (forensic)
- [x] Bucket detail "Inspect" tab
- [x] Key girilince `InspectObject` çağrı
- [ ] Display:
  - Versions (timestamp, size, headers)
  - Blocks (hash, size, replicating nodes)
  - System metadata (content-type, etag, mtime)
- [x] Versions + blocks + headers gösterimi

#### Repair operations
- [x] `LaunchRepairOperation` button (cluster sayfasında)
- [x] Repair types listesi (backend'den)
- [x] Multi-node selector (all nodes / per-node dropdown)

#### Dashboard widgets (Prometheus scrape)
- [x] `pages/home` ops dashboard (metrics card)
- [x] Backend `/api/metrics` proxy (metrics_token fallback)
- [x] Widget'lar (health, capacity, resync-errored, API rate, latency, backpressure):
  - **Cluster health**: `cluster_healthy`, `cluster_storage_nodes_ok`, `cluster_partitions_all_ok`
  - **Capacity per-node**: `garage_local_disk_avail/_total`
  - **Block resync errored** (kırmızı flag, healthy=0): `block_resync_errored_blocks`
  - **API rate**: `api_s3_request_counter`, `api_s3_error_counter`
  - **Latency p50/p95/p99**: `api_s3_request_duration` histogram
  - **Backpressure**: `block_ram_buffer_free_kb`
- [x] Charts: `recharts` (latency p50/p95/p99 bar + API-rate by endpoint)

#### Speedtest
- [x] Built-in S3 throughput tester (PUT/GET, 1KB-100MB)
  - PUT random data (varying sizes: 1KB, 1MB, 100MB)
  - GET back, measure throughput + latency
  - Per-node ölçüm (multipart parts farklı node'lara dağılır)
- [ ] Cmd+K shortcut entegrasyonu — eksik
- [ ] Results chart — şu an numeric, chart eksik

#### Testing
- [x] **Backend unit**: cluster routing, OIDC scope mapping, repair enum, bucket-access authz
- [x] **Frontend unit**: Vitest (parsePrometheus, expiryToISO, histogramQuantile)
- [x] **E2E (Playwright)** (dashboard, nav, layout, admin-token CRUD; +13 live security assertions):
  - bcrypt login → list buckets
  - OIDC mock login → list buckets
  - create bucket → upload file → download file → delete
  - create admin token → use it → revoke

---

## Faz 2 — UX & Polish (1-2 hafta)

- [ ] **Command Palette** (`kbar`) — Ctrl+K
  - Search across features (sayfalar, bucket'lar, key'ler)
  - Speedtest quick-launch
  - Recent commands history
- [ ] **Dark/light mode** — DaisyUI theme toggle, persist localStorage, system preference detect
- [ ] **Mobile responsive** — sidebar drawer, touch targets, adaptive nav
- [ ] **i18n** — `i18next` veya `react-intl`, TR + EN
- [ ] **Pagination component** — TanStack Query infinite query wrapper

---

## Faz 3 — DevOps (paralel olarak süre boyunca)

- [ ] **GitHub Actions**:
  - Lint + typecheck + test on PR
  - Multi-arch Docker build (amd64 + arm64)
  - Release on tag (binary artifacts + Docker push + GitHub Release)
- [ ] **Pre-commit hooks**: `golangci-lint` + `eslint` + `prettier`
- [ ] **Conventional commits** + `release-please`
- [ ] **Helm chart** (Mono RKE2 cluster'larında deploy için)
- [ ] **Documentation**:
  - User guide (mkdocs veya basit GitHub Pages)
  - API documentation (backend `/api`)
  - Architecture diagram (mermaid)

---

## Faz 4 — İleri Özellikler (Topluluk Talebi Gelirse)

- [ ] **Self-service tenant portal** — bucket sahibine sınırlı kapsamlı UI (sadece kendi bucket'larını yönetir)
- [ ] **Multi-cluster aggregated dashboard** — tüm cluster'lar tek pencerede toplu sağlık
- [ ] **K2V API browser** — Garage'de stable olunca
- [ ] **S3 Object Versioning UI** — Garage feature'ı geldiğinde (issue #166)
- [ ] **Audit log** — Garage built-in eklerse veya Loki entegrasyonu

---

## YAPILMAYACAKLAR (Garage'da Yok / Strateji Dışı)

| Özellik | Sebep |
|---|---|
| ~~Bucket Policies editor~~ | `PutBucketPolicy` yok |
| ~~IAM Policy Management~~ | Garage'de IAM yok (sadece access keys + admin tokens) |
| ~~Object Lock / Legal Hold~~ | Desteklenmiyor |
| ~~Bucket-level encryption (SSE-S3/KMS)~~ | SSE-C per-object var, bucket-level yok |
| ~~Bucket Notifications / webhooks~~ | Notifications API yok |
| ~~Object Tagging UI~~ | Tagging API yok |
| ~~Bucket Replication rules editor~~ | Garage zone-replication zaten yapıyor; layout view yeterli |
| ~~Audit log viewer~~ | Garage built-in audit yok (Loki entegrasyonu Faz 4) |
| ~~Real-time event stream (SSE/WS)~~ | Garage'de yok; polling kullanıyoruz |
| ~~SAML SSO~~ | Sadece OIDC (modern, yeterli) |
| ~~MFA~~ | Garage core'da yok; OIDC sağlayıcısı (Authelia/Keycloak) yapsın |
| ~~Object versioning UI~~ | Garage henüz desteklemiyor (issue #166, 2021'den beri açık) |

---

## Mimari Notlar

### Stack
- **Frontend**: React 18 + TypeScript + Vite + TanStack Query + Zustand + DaisyUI + Tailwind + react-hook-form + zod + sonner
- **Backend**: Go 1.21+ (`net/http`), embedded SPA via `go:embed`, oidc client via `coreos/go-oidc/v3`
- **Build**: Makefile, single binary (~< 25MB hedef)

### Garage v2.3 Constraints
- Tüm admin endpoint'leri `/v2/<Operation>` (RPC-style POST/GET)
- Auth: Bearer token (static `admin_token` discouraged, dynamic admin tokens recommended)
- **Event stream YOK** → polling: cluster health 5s, workers on-demand, metrics Prometheus pull
- **Object listing**: Admin API'de YOK → S3 API kullan (`ListObjectsV2`)
- `/check?domain=...` endpoint'i Caddy on-demand TLS için (gelecek deployment ihtiyacı)

### Differentiation Strategy
| Boyut | Resmi (`Deuxfleurs/garage-webadmin`) | Bizim |
|---|---|---|
| Stack | Vue + TS | React + TS |
| Cluster scope | Tek-cluster | Multi-cluster |
| Auth | Bilinmiyor | bcrypt + OIDC + scope mapping |
| Forensic | Yok | `InspectObject`, `BlockErrors`, repair |
| Object Browser | Minimal beklenen | MinIO Console UX paritesi |
| Bundle | Garage binary'siyle bundle olacak | Standalone, kurumsal odak |

### Deployment Notes
- 3 deploy hedefi: Single binary (systemd) / Docker / Helm chart (Kubernetes)
- **Ingress**: `/api` path Ingress kuralında HARDCODE EDİLMEMELİ. Tek host, tek backend service, `/api` UI tarafından internal routing — Ingress sadece host-based routing yapsın.
- `BASE_PATH` env var subpath deployment için (`https://infra.example.com/garage/`)
- `CLUSTERS_CONFIG` set edilmemişse mevcut single-cluster env-var modu çalışır (mevcut kullanıcılar etkilenmez)

### Compatibility Goals
- Garage **v2.3.0+** primary, v2.0/v2.1/v2.2 için endpoint feature detection
- Geriye uyumlu env-var config (mevcut deployment'lar etkilenmesin)
- Tek binary < 25MB hedef
- Dark mode + i18n + responsive Faz 2'de

---

## İlerleme Notları

- 2026-05-01: Roadmap reset — OpenMaxIO/openmaxio-object-browser fork'unun MinIO Console v1.7.6 olduğu ve Garage ile ilgili sıfır kod içerdiği keşfedildi. Stratejik karar: o repo sadece UX ilhamı, kod kopyalama yok (AGPL). Yön: Garage v2.3 admin parity + multi-cluster + OIDC + object browser MinIO-tarzı UX.
- 2026-06-06: Faz 1'in büyük kısmı tamamlandı (Sprint 1-5 + OIDC). 3-node Garage v2.3.0 dev cluster'ında E2E doğrulandı (11/11 endpoint + admin token CRUD). Kalan Faz 1 işleri: backend/frontend testleri, header scope badge, ClusterLayoutSkipDeadNodes UI, recharts grafikleri (latency histogram), react-window virtualization, ZIP bulk download, `make gen-types`, layout inline node editor.
- 2026-06-06 (2): Güvenlik sertleştirmesi + P1 özellikler. **Auth modeli MinIO paritesine getirildi**: S3-key kullanıcısı asla cluster-admin olamaz (bucket-owner escalation kaldırıldı), admin yalnızca AUTH_USER_PASS; merkezi assertBucketAccess ile cross-tenant erişim engellendi (inspect/speedtest/browse 403); AUTH_REQUIRED footgun guard + startup uyarısı; admin-tokens/current adminRouter'a taşındı. 13/13 canlı güvenlik testi geçti. **MDC sidecar**: presign URL'leri S3_PUBLIC_ENDPOINT_URL ile public host'a imzalanıyor (CF LB topolojisi). **P1 tamamlandı**: bucket lifecycle/expiration editörü, CORS editörü, quota UI, recharts latency+API-rate grafikleri, version-skew detector. **Düzeltmeler**: okunmayan DaisyUI temaları kaldırıldı (sadece Garage Dark/Light) + stale-theme guard; login formu MinIO-tarzı Access Key/Secret Key etiketlerine sadeleştirildi. Test altyapısı kuruldu: Go unit (utils+router+middleware), Vitest (14 test), Playwright E2E (4 test).
- NOT: TODO.md'de "YAPILMAYACAKLAR" listesindeki **CORS** ve **bucket lifecycle/expiration** Garage v2.3 UpdateBucket API'sinde destekleniyor; ikisi de implement edildi (liste güncellenmeli).
