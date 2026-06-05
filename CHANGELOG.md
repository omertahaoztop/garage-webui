# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Multi-cluster support.** A single Garage Web UI binary can now manage multiple Garage clusters concurrently.
  - New `CLUSTERS_CONFIG` environment variable points at a YAML registry of clusters.
  - Each cluster declares its own `admin_url`, `admin_token` (or `admin_token_env`), `s3_endpoint` and `s3_region`.
  - Existing single-cluster `API_BASE_URL`, `API_ADMIN_KEY`, `S3_ENDPOINT_URL`, `S3_REGION` env vars remain fully backward compatible when `CLUSTERS_CONFIG` is not set.
- `X-Cluster-Id` request header — every backend route is now cluster-aware and routes calls to the matching registry entry. Missing header falls back to the registry's `default` cluster.
- `GET /api/clusters` endpoint — lists registered clusters with secrets redacted (`hasToken` boolean returned in place of tokens).
- `GET /api/clusters/{id}/test` endpoint — performs a live `/v2/GetClusterHealth` probe against the selected cluster and returns the result.
- Sidebar **cluster switcher** dropdown with per-cluster live health dot (green/amber/red). Hidden automatically when only a single cluster is configured.
- Zustand `cluster-store` persists the active cluster id in `localStorage` under the `cluster` key.
- 3-node Garage v2.3.0 development cluster scaffolding under `docker/cluster/` (compose file, per-node `garage.toml`, idempotent `init.sh` bootstrap script, README).

### Changed

- **Target Garage version** bumped to v2.3+. All admin calls go through the `/v2/<Operation>` surface; v1 endpoints are no longer used by the UI.
- `backend/utils` Garage client refactored from a process-wide singleton to a per-cluster `Cluster` struct carried on `http.Request` context via `utils.GetCluster(r)`. Routers (`auth`, `buckets`, `browse`, `proxy`, `config`) no longer reach into a global.
- `AuthMiddleware`, `AdminMiddleware`, and `UserOrAdminMiddleware` now share a single `authDisabled()` helper. When `AUTH_USER_PASS` is empty, all three short-circuit to allow-all (development convenience). When set, full bcrypt + session enforcement is restored on every middleware.
- Bucket-credential cache key changed from `key:<bucket>` to `key:<clusterID>:<bucket>` to prevent cross-cluster credential leakage in multi-cluster deployments.
- `backend/router/clusters.go` introduced; `backend/middleware/cluster.go` introduced to populate the request-scoped cluster.

### Removed

- `backend/utils/garage.go` singleton (`utils.Garage.*` API) — superseded by the per-request `Cluster` client. External consumers of the internal Go API must migrate to `utils.GetCluster(r)`.

### Notes for upgraders

- **No action required** for users running a single cluster via existing `API_BASE_URL`/`API_ADMIN_KEY`/`S3_ENDPOINT_URL`/`S3_REGION` env vars — they continue to work. The frontend cluster switcher is automatically hidden when only one cluster is configured.
- The UI is rebuilt with React + Zustand cluster state; static assets in `backend/ui/dist/` change on every build.

## [1.1.0] - Upstream

Imported from upstream `khairul169/garage-webui@1.1.0`. See the [upstream releases](https://github.com/khairul169/garage-webui/releases) for the historical changelog.
