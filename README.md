# Auto-PostIt

Auto-PostIt is being revived as a focused, single-user, self-hosted application for scheduling URL-based social posts. The current repository contains an earlier implementation; provider code and features present in the tree must not be interpreted as production support until they pass the revival plan's gates.

## Focused MVP

Every post must contain at least one valid `http://` or `https://` URL. A post may include one image or no image; more than one image is rejected. Video uploads are not supported anywhere, including YouTube video uploads.

The destination allowlist is exactly:

- **X**
- **Facebook Page**
- **YouTube Posts/Community Posts**, gated on an official API proof of concept

LinkedIn, Instagram, Pinterest, and all other providers are explicitly out of scope. YouTube Posts are **not currently claimed as supported**: an adapter must not be implemented until an official, documented API proves that a post can be created. Browser automation and undocumented endpoints are prohibited.

This first revival change is documentation-only. Runtime behavior has not yet been aligned with this scope. The existing runtime still contains legacy platform and media paths, so it must be treated as incomplete until later implementation phases enforce the documented contract.

## Documentation

Start with the revival design documents:

| Document | Purpose |
| --- | --- |
| [Current Design](docs/design/CURRENT-DESIGN.md) | Describes the existing application, data, scheduling, deployment, and public-repository secret boundaries. |
| [Revival Plan](docs/design/REVIVAL-PLAN.md) | Defines the phased path from contract enforcement through provider certification and private deployment. |

Additional historical/reference documentation remains under [`docs/`](docs/). Where older documents conflict with the two design documents above, the focused MVP and revival plan take precedence.

| Historical/reference document | Description |
| --- | --- |
| [PRD.md](docs/PRD.md) | Product Requirements Document |
| [SECURITY.md](docs/SECURITY.md) | Security architecture and guidelines |
| [PLATFORM_LIMITS.md](docs/PLATFORM_LIMITS.md) | API quotas and rate limits per platform |
| [PLATFORM_CONFIGURATION.md](docs/PLATFORM_CONFIGURATION.md) | OAuth setup for each platform |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture and deployment |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Development standards and workflow |

## Current technology

| Component | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| API | Node.js, Express, TypeScript |
| Database | PostgreSQL with Prisma |
| Queue/worker | Redis and BullMQ |
| Media | Local persistent storage |
| Deployment | Docker Compose behind Apache |

## Development status

The repository has a usable scaffold from the earlier application, but revival work is not complete and the runtime/platform behavior is not yet aligned with the focused MVP.

- [x] Requirements & revival documentation
- [x] Project scaffolding
- [x] Existing authentication and MFA paths
- [x] Existing core post-management paths
- [ ] Enforce focused MVP contract at runtime: URL required, zero-or-one image, no video, exact provider allowlist
- [ ] Disable or remove legacy LinkedIn, Instagram, Pinterest, video-upload, and other out-of-scope runtime paths
- [ ] Certify X against official APIs
- [ ] Certify Facebook Page against official APIs
- [ ] Resolve YouTube Posts/Community Posts official API feasibility before adapter work
- [ ] Harden Docker deployment for the documented VPS topology
- [ ] Repair publishing reliability, retries, stale-job recovery, and target-level idempotency
- [ ] Testing and provider certification evidence

## Getting Started

These instructions describe the existing local Docker workflow. They are useful for repository onboarding, but do not mean the runtime has been aligned with or certified for the focused MVP.

### Prerequisites

- Node.js >= 20.0.0
- Docker & Docker Compose
- Git

### Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/pexus/auto-postit.git
   cd auto-postit
   ```

2. **Configure environment**
   ```bash
   cp env.example .env
   # Edit .env with your settings
   ```

   Do not commit populated `.env` files, OAuth credentials, tokens, passwords, private media, dumps, backups, or other sensitive material.

3. **Build and start**
   ```bash
   scripts/docker-build.sh
   scripts/docker-up.sh
   ```

4. **Open the app**
   - Web UI: http://localhost:8080
   - API: http://localhost:8080/api

### Project Structure

```text
auto-postit/
├── backend/           # Express.js API
│   ├── src/
│   │   ├── config/    # Environment configuration
│   │   ├── lib/       # Shared utilities
│   │   ├── middleware/# Express middleware
│   │   └── routes/    # API routes
│   └── prisma/        # Database schema
├── frontend/          # React SPA
│   └── src/
│       ├── components/# UI components
│       ├── contexts/  # React contexts
│       ├── layouts/   # Page layouts
│       ├── lib/       # Utilities
│       └── pages/     # Page components
├── docs/              # Documentation
└── docker-compose.yml # Development services
```

## Production target

The supported target will be an Ubuntu 24.04 VPS using native Docker Compose v2. Apache handles public TLS and reverse proxying. Auto-PostIt containers bind to localhost, while PostgreSQL and Redis remain private/internal.

Production secrets remain outside the repository at `/etc/auto-postit/auto-postit.env` with mode `600`. Never commit OAuth credentials, tokens, populated `.env` files, passwords, private media, dumps, backups, or other sensitive material.

Implementation and deployment instructions will be updated in later phases as the documented controls are built and verified.

## Contributing

This project is being revived in small, reviewable PRs. Until the focused MVP is implemented and certified, contributions should keep product scope narrow and avoid expanding provider or media support beyond the documented allowlist.

For this revival phase:

- Prefer documentation, tests, deployment hardening, and runtime enforcement of the documented contract.
- Do not add OAuth credentials, tokens, populated `.env` files, passwords, private media, dumps, backups, or other sensitive material.
- Do not implement browser automation, undocumented provider endpoints, or YouTube video uploads.
- Treat X, Facebook Page, and YouTube Posts/Community Posts as the only destination names in scope, with YouTube gated on an official API proof of concept.

## License

Auto-PostIt is available under the [MIT License](LICENSE).
