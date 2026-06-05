# syntax=docker/dockerfile:1.7
# Garage WebUI multi-stage image.
#
# Build context = repo root. Produces a slim alpine runtime carrying:
#   - the embedded SPA (built by Vite/pnpm)
#   - the Go HTTP server (build tag `prod` so go:embed picks up ui/dist)
#
# Typical usage:
#   docker build -t garage-webui:dev .
#   docker run --rm -p 3909:3909 \
#     -e API_BASE_URL=http://garage1:3903 \
#     -e API_ADMIN_KEY=... \
#     -e S3_ENDPOINT_URL=http://garage1:3900 \
#     -e S3_REGION=garage \
#     garage-webui:dev

# ---------- 1) Frontend bundle ----------
FROM node:22-slim AS frontend
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml ./
# NOTE: --mount=type=cache requires BuildKit; sticking to classic-builder-safe install.
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# ---------- 2) Backend (Go) ----------
FROM golang:1.25-bookworm AS backend
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
# Embed the SPA produced above so `-tags prod` picks it up via go:embed
COPY --from=frontend /app/dist ./ui/dist
ENV CGO_ENABLED=0 GOOS=linux
RUN go build -tags prod -trimpath -ldflags="-s -w" -o /out/garage-webui .

# ---------- 3) Runtime ----------
FROM alpine:3.20
RUN apk add --no-cache ca-certificates curl tzdata \
 && addgroup -S app && adduser -S -G app app
COPY --from=backend /out/garage-webui /usr/local/bin/garage-webui
USER app
ENV HOST=0.0.0.0 PORT=3909
EXPOSE 3909
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3909/api/auth/status >/dev/null || exit 1
ENTRYPOINT ["/usr/local/bin/garage-webui"]
