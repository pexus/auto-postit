# Revival Plan

## Goal and acceptance boundary

Revive Auto-PostIt as a reliable **single-user, self-hosted** URL-sharing scheduler, not as a general-purpose multi-provider media publisher. This plan sequences safety and reliability before provider certification. A provider is enabled only after its official API path has been exercised end to end in the private deployment.

The MVP accepts text containing at least one valid `http://` or `https://` URL and optionally one image. It rejects multiple images and every video upload, including YouTube video uploads. Its destination allowlist is exactly X, Facebook Page, and YouTube Posts/Community Posts. LinkedIn, Instagram, Pinterest, and all other destinations are explicitly out of scope.

YouTube Posts/Community Posts remain gated on official API feasibility. They are not supported merely because legacy YouTube code exists.

## Phase 1 — Enforce the post and provider contract

Apply the contract consistently to interactive creation/editing, imports, APIs, database-facing services, queued jobs, and provider dispatch:

- Require at least one syntactically valid URL whose scheme is exactly `http` or `https`; reject missing or malformed URLs.
- Permit zero or one image attachment and reject a second image.
- Reject video MIME types, extensions, uploads, references, and dispatch everywhere. Do not retain a special YouTube video path.
- Allow destinations only for X, Facebook Page, and the gated YouTube Posts/Community Posts target.
- Disable/remove LinkedIn, Instagram, Pinterest, and other legacy provider choices and reject them server-side even if a client bypasses the UI.
- Keep YouTube Posts unavailable until Phase 6 passes; represent the gate clearly rather than presenting a nonfunctional destination.
- Add tests for every boundary and for bypass attempts across UI, API, import, persisted data, and worker inputs.

**Exit:** the same narrow rules are enforced at every trust boundary, and legacy data cannot cause an out-of-scope publish.

## Phase 2 — Harden Docker deployment

Make the supported production topology reproducible on Ubuntu 24.04 with native Docker Compose v2:

- Run versioned Prisma migrations as an explicit, fail-fast deployment step before application rollout; never use development schema mutation in production.
- Add meaningful liveness and readiness checks for the API, worker dependencies, PostgreSQL, and Redis, and make startup ordering depend on readiness where appropriate.
- Bind Auto-PostIt published ports to `127.0.0.1` only. Keep PostgreSQL and Redis un-published on private/internal networks. Document Apache host TLS termination and reverse proxy configuration.
- Make bootstrap-admin creation one-time, race-safe, auditable, and unavailable after the sole account exists.
- Store OAuth state in Redis with cryptographically random values, short TTLs, single-use consumption, and binding to the initiating session/provider.
- Document and test scheduled backups and restores for PostgreSQL, Redis if it holds required durable queue state, and local media. Encrypt and protect backup destinations.
- Set CPU, memory, log-rotation, restart, and disk-usage limits appropriate to the VPS, with capacity guidance and alerts.
- Document rollback of images and application releases, including schema compatibility and a restore-based path for irreversible migrations.
- Add CI dependency checks and secret scanning for commits, configuration, images where practical, and generated artifacts.
- Load production secrets only from `/etc/auto-postit/auto-postit.env`, mode `600`; never copy that file into the repository or images.

**Exit:** a clean host can deploy, verify, back up, restore, and roll back without exposing containers or secrets.

## Phase 3 — Repair publishing reliability

Treat queue delivery as at-least-once and make repeated work safe:

- Replace the status-update/queue-add gap with transactional queue claims (for example, a database outbox or an equivalently crash-safe claim protocol).
- Define bounded exponential retries with jitter, provider-aware retry classification, rate-limit handling, and a terminal failure policy.
- Recover stale claims/jobs after worker crashes without duplicating completed target publications.
- Introduce stable, target-level idempotency keys and persist attempt/result state per post destination. Use official provider idempotency support when available and reconcile uncertain outcomes before retrying.
- Deliver images safely through a provider-supported upload flow or narrowly scoped, authenticated, expiring URLs. Never make the media library broadly public; validate file identity, type, size, and ownership immediately before dispatch.
- Add structured, redacted logs and operational visibility for queued, running, retrying, stale, successful, and dead-letter work.
- Test crashes at each state transition and partial success across multiple targets.

**Exit:** restarts and duplicate delivery cannot silently lose work, and retry behavior minimizes duplicate public posts.

## Phase 4 — Implement and certify X

Implement only documented X APIs and the MVP content/media contract. Confirm OAuth scopes, token refresh/expiry behavior, text and URL handling, one-image upload, rate limits, errors, idempotency/reconciliation behavior, and deletion/disconnect hygiene. Exercise contract, sandbox/test-account, failure, and live private-deployment tests. Record the API versions, scopes, evidence, limitations, and certification date.

**Exit:** X is enabled only after repeatable end-to-end certification on the VPS topology.

## Phase 5 — Implement and certify Facebook Page

Implement only documented Meta APIs for a Facebook Page—not personal profiles or Instagram. Verify Page selection and permissions, long-lived token behavior, text/link posts, optional single-image posts, rate limits, review requirements, errors, and retry reconciliation. Test with a controlled Page and record versions, permissions, evidence, limitations, and certification date.

**Exit:** Facebook Page is enabled only after repeatable end-to-end certification on the VPS topology.

## Phase 6 — Resolve YouTube Posts API feasibility

Before coding an adapter, build a time-boxed proof of concept against current **official, documented Google/YouTube APIs** to answer whether the authenticated channel can create a YouTube Post/Community Post with the MVP payload.

- Do not use browser automation, headless browsers, scraped internal calls, reverse-engineered or undocumented endpoints.
- Do not substitute a YouTube video upload; video is unsupported throughout this product.
- Record the official endpoint, authorization scopes, eligibility constraints, quota, request/response evidence, and platform policy requirements.
- Obtain a reproducible successful creation through the official API before considering adapter implementation.

If the proof succeeds, review the evidence and plan adapter implementation and certification as a separately approved scope. If no official creation API exists or the proof fails, keep YouTube Posts disabled and clearly marked unavailable. Do not claim support.

**Exit:** a documented go/no-go decision backed by official documentation and proof-of-concept evidence; no speculative production adapter.

## Phase 7 — Private VPS deployment and certification

Deploy to the Ubuntu 24.04 VPS with Docker Compose v2. Apache terminates TLS and proxies only to localhost-bound Auto-PostIt services; PostgreSQL and Redis remain internal. Load mode-`600` secrets from `/etc/auto-postit/auto-postit.env` outside the checkout.

Run restore and rollback drills, readiness and resource checks, security checks, URL/image/video contract tests, scheduled and immediate publishing tests, retry/crash-recovery tests, and token expiry/refresh tests. Certify only providers that completed their phase gates. Keep failed, incomplete, or infeasible providers disabled.

**Exit:** the private deployment passes the operational checklist, backups are restorable, and each enabled provider has current end-to-end evidence.

## Definition of MVP complete

The revival MVP is complete when the production deployment reliably schedules URL-containing posts with at most one image to each **enabled and certified** allowlisted provider, rejects all videos and out-of-scope providers at every boundary, survives retries/restarts without uncontrolled duplicates, and meets the documented secret and network boundaries. The three-name allowlist does not override certification gates: YouTube Posts remains disabled unless Phase 6 proves feasibility and a subsequent adapter is explicitly implemented and certified.
