# Current Design

## Purpose and status

This document records the repository as it exists at the start of the revival. It is descriptive, not a claim that every path is production-ready or that every provider adapter is certified. The focused target and the work needed to reach it are defined in the [revival plan](REVIVAL-PLAN.md).

Auto-PostIt is designed as a single-user, self-hosted scheduler. The repository is split into a browser application, an API, a background publishing worker, and private data services.

## Application architecture

### Frontend

The frontend is a React and TypeScript single-page application built with Vite. Tailwind CSS and reusable UI components provide the presentation layer. It contains authenticated routes for setup/login, a dashboard, post creation and editing, media, imports, platform connections, quota information, and settings. The browser calls the Express API and obtains a CSRF token for state-changing requests.

### Backend

The backend is an Express application written in TypeScript. It exposes health, authentication, public OAuth callback, and authenticated API routes. Middleware provides Helmet headers, configured CORS, request rate limiting, JSON parsing, signed cookies, server-side sessions, CSRF validation, request logging, and centralized error handling.

The API uses Prisma to access PostgreSQL. Provider-specific services and a publishing service currently exist, but their presence must not be read as certification. In particular, the revival MVP only allows X, Facebook Page, and—subject to the feasibility gate below—YouTube Posts/Community Posts. Existing LinkedIn, Instagram, Pinterest, video-upload, and other provider paths are legacy surface area to disable or remove in later implementation PRs.

### Database and queue

PostgreSQL is the system of record and Prisma defines and accesses its schema. Redis backs Express sessions and BullMQ. A separate TypeScript worker consumes BullMQ jobs; a repeating scan identifies due posts, marks them as publishing, and enqueues publication work.

The current claim/enqueue sequence is not fully transactional, and generated job identifiers do not by themselves establish provider-level idempotency. Retry policy, stale-job recovery, and crash consistency are therefore revival work rather than current guarantees.

### Local media storage

Uploaded media metadata is stored in PostgreSQL while files are stored on a local persistent volume. The API initializes and serves the configured upload area, and both API and worker containers mount it. The current model can represent images and videos and multiple attachments. The MVP contract is narrower: zero or one image per post, with all video uploads and multiple images rejected at every entry point.

## Authentication and OAuth tokens

The first-user setup path creates the sole local account. Passwords are hashed, login state is held in a Redis-backed server-side session, and optional TOTP MFA and backup codes are supported. Authentication activity is audit logged. The single-user constraint is a product boundary; revival hardening must ensure bootstrap administration cannot be raced or reopened after setup.

Connected-platform records hold provider identity and metadata. OAuth access tokens, optional refresh tokens, and MFA secrets are intended to be encrypted at rest using the configured encryption key. OAuth client credentials and encryption keys are runtime secrets, never repository content. OAuth authorization state must be short-lived, single-use, and stored in Redis rather than relying on process memory.

## Scheduling and publishing flow

1. The authenticated user creates a draft, chooses connected destinations, and may schedule it.
2. A scheduled post is persisted in PostgreSQL with target rows and optional media associations.
3. The worker's periodic BullMQ scan finds posts due for publishing and attempts to move them from `SCHEDULED` to `PUBLISHING`.
4. A publish job loads the post, its media, and each selected target, then invokes the corresponding provider service.
5. Per-target results and provider post identifiers/URLs are recorded, and the aggregate post becomes published, partially published, or failed.

The intended MVP input contract is mandatory for future implementation work:

- Post content contains at least one syntactically valid `http://` or `https://` URL.
- A post may have no attachment or exactly one valid image attachment.
- More than one image is rejected.
- Video is rejected in the UI, API, imports, media library, scheduler, worker, and every provider adapter. YouTube video uploads are not supported.
- The destination allowlist is exactly **X**, **Facebook Page**, and **YouTube Posts/Community Posts**.
- LinkedIn, Instagram, Pinterest, and every other provider are out of scope.

YouTube Posts/Community Posts are an **API feasibility gate**, not a supported adapter. No adapter may be claimed or implemented until an official, documented API proof-of-concept demonstrates that a post can be created. Browser automation and undocumented endpoints are prohibited.

## Current data model

The Prisma schema currently contains:

- `User` and `Session` for the local account, MFA state, and sessions.
- `Platform` for a connected provider account/page, encrypted OAuth tokens, expiry, and provider metadata.
- `Post` for content, schedule, aggregate status, and timestamps.
- `PostPlatform` for selected targets, optional content overrides, target status, provider identifiers/URLs, and errors.
- `MediaFile` and `PostMedia` for locally stored attachment metadata and post associations.
- `QuotaUsage` for provider-period request and post counters.
- `AuditLog` for security and operational actions.
- `ScheduledJob` for persisted job references, status, attempts, errors, and completion data.

The schema still enumerates legacy providers and permits media shapes outside the MVP. Phase 1 will align validation, UI, imports, persistence constraints where practical, and worker defenses with the narrower contract.

## VPS deployment design

The production target is deliberately specific:

- Ubuntu 24.04 on a single VPS.
- Native Docker Compose v2 (`docker compose`), not the legacy standalone `docker-compose` binary.
- Apache on the host terminates public TLS and reverse-proxies to Auto-PostIt.
- Published Auto-PostIt container ports bind only to `127.0.0.1`; containers are never directly exposed on public interfaces.
- PostgreSQL and Redis have no host-published ports and remain on private/internal Compose networks.
- Persistent volumes hold PostgreSQL, Redis, and local uploads; backup and restore procedures must cover all durable state.

Only Apache is internet-facing. Health/readiness checks must distinguish a running process from an application ready to serve traffic, including required database and Redis dependencies.

## Public-repository secret boundary

The Git repository may contain variable names, redacted examples, and operational instructions only. It must never contain OAuth client secrets, access or refresh tokens, session/cookie/CSRF secrets, encryption keys, passwords, populated `.env` files, database dumps, private media, backup archives, or logs containing sensitive values.

Production secrets live outside the checkout at:

```text
/etc/auto-postit/auto-postit.env
```

That file is owned by the deployment administrator/service account as appropriate, has mode `600`, and is supplied to Compose at deployment time. It is not copied into an image, mounted into a public web root, printed in CI, or committed. Secret scanning is required in CI and before release/deployment changes are merged.
