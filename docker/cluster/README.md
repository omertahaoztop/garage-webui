# Garage Cluster (dev/test) — sidecar topology

Local stand-in for the **recommended production topology**:

> 1 Garage cluster, **N geographic nodes** (IST, AMS, FRA, ...), each node
> co-located with a `garage-webui` sidecar pinned to its own
> `localhost:3903`. A global edge load balancer (Cloudflare LB origin pool,
> AWS NLB, etc.) fans traffic across the sidecars. Garage's gossip protocol
> keeps every sidecar observing the same cluster state, so the UI is
> functionally identical no matter which DC the user lands on.

This compose file emulates that on a single host with 3 Garage daemons
(zones `dc1/dc2/dc3`) + 3 sidecars + an nginx pretending to be Cloudflare LB.

```
                       ┌──────────────────────────────┐
   client ───► nginx LB (port 8080) ──► round-robin   │
                       │   ▲                          │
                       │   │                          │
        ┌──────────────┼───┴──────────────┐           │
        ▼              ▼                  ▼           │
   webui1:3909    webui2:3909        webui3:3909      │  (per-node sidecars)
        │              │                  │           │
        ▼              ▼                  ▼           │
   garage1:3903   garage2:3903       garage3:3903     │
   (dc1 - zone)   (dc2 - zone)       (dc3 - zone)     │
        └──────────────┬──────────────────┘           │
                       ▼                              │
              Gossip + RPC (3901)                     │
              Replication factor = 3, consistent      │
                       │                              │
   S3 endpoints:  3911 / 3912 / 3913  (host-side)     │
   Web endpoints: 3921 / 3922 / 3923  (host-side)     │
   Admin endpts:  3931 / 3932 / 3933  (host-side)     │
                       └──────────────────────────────┘
```

## Quick start

```bash
# From repo root:
docker compose -f docker-compose.cluster.yml up -d --build
./docker/cluster/init.sh        # connects nodes, assigns layout, creates webui-test bucket + dev key
```

## Reach the cluster

| URL                                  | What it gives you                                            |
| ------------------------------------ | ------------------------------------------------------------ |
| `http://localhost:8080/`             | UI through the round-robin LB (production-like path)         |
| `http://localhost:3909/`             | Direct hit on `webui1` (dc1) sidecar                         |
| `http://localhost:3910/`             | Direct hit on `webui2` (dc2) sidecar                         |
| `http://localhost:3914/`             | Direct hit on `webui3` (dc3) sidecar                         |
| `http://localhost:3931/v2/...`       | Direct Garage admin API on dc1                               |
| `http://localhost:3911/...`          | Direct Garage S3 endpoint on dc1                             |

`init.sh` creates a `webui-test` bucket and the dev access key
`webui-dev-key` (`GK32b52ace2d88c21dabd3534f` / secret in the script
output) so the UI has something to render immediately.

## What every container does

| Service  | Image                       | Purpose                                                      |
| -------- | --------------------------- | ------------------------------------------------------------ |
| garage1  | `dxflrs/garage:v2.3.0`      | Storage node in zone `dc1`                                   |
| garage2  | `dxflrs/garage:v2.3.0`      | Storage node in zone `dc2`                                   |
| garage3  | `dxflrs/garage:v2.3.0`      | Storage node in zone `dc3`                                   |
| webui1   | `garage-webui:dev` (local)  | Sidecar pinned to `garage1:3903` (admin) + `garage1:3900` (s3) |
| webui2   | `garage-webui:dev` (local)  | Sidecar pinned to `garage2:3903` + `garage2:3900`            |
| webui3   | `garage-webui:dev` (local)  | Sidecar pinned to `garage3:3903` + `garage3:3900`            |
| lb       | `nginx:1.27-alpine`         | Round-robin upstream over all 3 sidecars, port `8080`        |

## Why sidecars, not a single multi-cluster WebUI?

Two-fold:

1. **Latency / blast radius.** Each sidecar talks to `localhost`. Admin
   API hits never cross the Internet (or even the rack). If one DC's
   uplink dies, only that origin drops out of the LB pool — the UI stays
   up everywhere else.
2. **Cloud-native load balancing.** Cloudflare LB / AWS NLB already know
   how to round-robin, geo-steer, fail over, and present a single
   hostname. Re-implementing that inside a single "multi-cluster" WebUI
   would duplicate the network's job.

The multi-cluster registry shipped in `backend/utils/cluster.go` is still
useful, but for a **different** use case: when one operator manages
**several independent Garage clusters** (e.g. `prod-eu`, `prod-us`,
`staging`) from one pane of glass. In the single-cluster sidecar mode
the dropdown auto-hides (single entry) and `X-Cluster-Id` is implicitly
`default`.

## Reference values (dev only — never use in prod)

- Admin token: `garagewebui-dev-admin-token-DO-NOT-USE-IN-PROD`
- Metrics token: `garagewebui-dev-metrics-token-DO-NOT-USE-IN-PROD`
- RPC secret (32-byte hex): `7bdc1e84bd50a8ccd861bca5ad3cadb67937ca02f2994b7ba37e5fdf43503c78`
- Static IPs: garage1=172.28.0.11, garage2=172.28.0.12, garage3=172.28.0.13
- Network name: `garage_cluster` (subnet 172.28.0.0/24)

## Teardown

```bash
docker compose -f docker-compose.cluster.yml down              # keep volumes
docker compose -f docker-compose.cluster.yml down -v           # wipe volumes too
```

## Troubleshooting

- `docker compose ps` should show all 7 services healthy after ~30s.
- `docker compose logs lb` confirms nginx upstream resolution.
- `curl -s http://localhost:8080/api/clusters | jq` lists 1 cluster
  (`default`) per sidecar — this is expected in sidecar mode.
- If the sidecars boot before garage is ready, the healthcheck cycle
  will retry; otherwise inspect with
  `docker compose logs webui1` and `docker compose logs garage1`.
