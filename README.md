# Auto-PostIt

Auto-PostIt is being revived as a focused, single-user, self-hosted application for scheduling URL-based social posts. The current repository contains an earlier implementation; provider code and features present in the tree must not be interpreted as production support until they pass the revival plan's gates.

## Focused MVP

Every post must contain at least one valid `http://` or `https://` URL. A post may include one image or no image; more than one image is rejected. Video uploads are not supported anywhere, including YouTube video uploads.

The destination allowlist is exactly:

- **X**
- **Facebook Page**
- **YouTube Posts/Community Posts**, gated on an official API proof of concept

LinkedIn, Instagram, Pinterest, and all other providers are explicitly out of scope. YouTube Posts are **not currently claimed as supported**: an adapter must not be implemented until an official, documented API proves that a post can be created. Browser automation and undocumented endpoints are prohibited.

This first revival change is documentation-only. Runtime behavior has not yet been aligned with this scope.

## Documentation

Start with the revival design documents:

| Document | Purpose |
| --- | --- |
| [Current Design](docs/design/CURRENT-DESIGN.md) | Describes the existing application, data, scheduling, deployment, and public-repository secret boundaries. |
| [Revival Plan](docs/design/REVIVAL-PLAN.md) | Defines the phased path from contract enforcement through provider certification and private deployment. |

Additional historical/reference documentation remains under [`docs/`](docs/). Where older documents conflict with the two design documents above, the focused MVP and revival plan take precedence.

## Current technology

| Component | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| API | Node.js, Express, TypeScript |
| Database | PostgreSQL with Prisma |
| Queue/worker | Redis and BullMQ |
| Media | Local persistent storage |
| Deployment | Docker Compose behind Apache |

## Production target

The supported target will be an Ubuntu 24.04 VPS using native Docker Compose v2. Apache handles public TLS and reverse proxying. Auto-PostIt containers bind to localhost, while PostgreSQL and Redis remain private/internal.

Production secrets remain outside the repository at `/etc/auto-postit/auto-postit.env` with mode `600`. Never commit OAuth credentials, tokens, populated `.env` files, passwords, private media, dumps, backups, or other sensitive material.

Implementation and deployment instructions will be updated in later phases as the documented controls are built and verified.

## License

Auto-PostIt is available under the [MIT License](LICENSE).
