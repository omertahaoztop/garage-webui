# Contributing

Thanks for your interest in improving garage-webui.

## Development setup

Prerequisites: **Node 22 + pnpm 9.15.9**, **Go 1.25**, and (optionally) Docker
for the local cluster.

```sh
pnpm install              # frontend deps
pnpm run dev              # frontend (Vite) + backend (air) together
```

A throwaway 3-node Garage v2.3 cluster for manual/E2E testing:

```sh
docker compose -f docker-compose.cluster.yml up -d --build
./docker/cluster/init.sh        # layout + test bucket + dev key
open http://localhost:8080      # via the LB
```

## Checks (must pass before a PR)

These are exactly what CI runs:

```sh
# Frontend
pnpm run lint
pnpm exec tsc -b
pnpm exec vitest run
pnpm run build

# Backend
cd backend
go vet ./...
go test -race ./...
golangci-lint run        # if installed
```

Playwright E2E (requires the local cluster running on :3909):

```sh
pnpm exec playwright test
```

## Pull requests

- Keep PRs focused; one logical change per PR.
- Add/adjust tests for behavior changes. Security-relevant code
  (auth, bucket access) **must** include tests.
- Use clear, conventional commit subjects (e.g. `fix:`, `feat:`, `docs:`).
- Update `CHANGELOG.md` (Unreleased section) for user-facing changes.

## Security model (do not regress)

Admin access comes **only** from `AUTH_USER_PASS`/OIDC; S3-key users are
strictly bucket-scoped via the centralized `assertBucketAccess` check. See
[SECURITY.md](SECURITY.md). Any change touching authentication or
authorization needs accompanying tests and a careful review.

## License

By contributing you agree your contributions are licensed under the project's
[GPLv3](LICENSE).
