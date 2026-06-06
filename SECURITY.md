# Security Policy

## Reporting a Vulnerability

Please **do not** open public GitHub issues for security vulnerabilities.

Report privately via GitHub's [Private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
("Report a vulnerability" under the repository's **Security** tab), or email the
maintainer.

Please include: affected version/commit, a description, reproduction steps, and
impact. We aim to acknowledge within 72 hours and to ship a fix or mitigation as
quickly as the severity warrants.

## Supported Versions

Security fixes target the latest released minor version and `main`. Older
versions are not maintained.

## Authentication & Authorization Model

This project enforces a strict separation between control-plane administrators
and data-plane (bucket) users. These are guarantees, and regressions are treated
as security bugs:

- **Admin access is granted ONLY via `AUTH_USER_PASS`** (a bcrypt
  username/password) or an OIDC identity explicitly mapped to admin scope.
  Logging in with S3 access keys **never** grants cluster-admin, even for a key
  that owns a bucket.
- **S3-key users are strictly bucket-scoped.** They may read cluster status and
  browse/manage only the buckets their key can access. Every bucket-scoped
  endpoint enforces this through a single, centralized check
  (`assertBucketAccess`), covering browse, inspect, presign, copy/move,
  multipart, share, and speedtest.
- **No silent open mode.** When no auth provider is configured the server logs a
  loud warning. Set `AUTH_REQUIRED=true` to fail closed regardless of provider
  configuration.
- **Sessions are server-side** (the `isAdmin` flag cannot be forged by the
  client).
- **Admin tokens / admin metadata** are never exposed to non-admin sessions.

## Hardening Recommendations for Operators

- Always set `AUTH_USER_PASS` (or OIDC) in production; never run with auth
  disabled on an untrusted network.
- Terminate TLS at a reverse proxy / load balancer in front of the UI.
- Prefer the dynamic admin-token model over a static `admin_token` for the
  Garage cluster where possible.
- Keep the container image up to date; releases are rebuilt against current Go
  and dependency versions.
