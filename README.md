# Auto-PostIt

> Active development, but fully usable for single-user self-hosted deployments.

A minimalist, self-hosted social media scheduling and auto-posting application designed for single-user operation. A simpler alternative to Postiz, focusing on ease of use, reliability, and staying within free API tier limits.

## 🎯 Purpose

Built for small business owners, content creators, and music labels who need a simple, self-hosted solution to schedule and publish content across multiple social media platforms without the complexity of enterprise SaaS tools.

## ✨ Features

- **Multi-Platform Support**: X (Twitter), LinkedIn (Profile + Company Pages), Facebook Pages, Instagram Business, YouTube, Pinterest
- **Scheduling**: Drafts, scheduled posts, and immediate publishing
- **Media Management**: Upload and manage images/videos
- **Refine with AI**: Improve post copy using OpenAI API (optional)
- **Import**: CSV/XLSX import for bulk scheduling
- **Quota Tracking**: Usage dashboard to stay within platform limits
- **Security**: Encrypted token storage, optional TOTP-based MFA
- **Self-Hosted**: Docker-based deployment (default port 8080)

## 📋 Documentation

| Document | Description |
|----------|-------------|
| [PRD.md](docs/PRD.md) | Product Requirements Document |
| [SECURITY.md](docs/SECURITY.md) | Security architecture and guidelines |
| [PLATFORM_LIMITS.md](docs/PLATFORM_LIMITS.md) | API quotas and rate limits per platform |
| [PLATFORM_CONFIGURATION.md](docs/PLATFORM_CONFIGURATION.md) | OAuth setup for each platform |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture and deployment |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Development standards and workflow |

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js, Express.js, TypeScript |
| Frontend | React, Vite, Tailwind CSS, shadcn/ui |
| Database | PostgreSQL |
| Queue | BullMQ, Redis |
| ORM | Prisma |
| Auth | Passport.js, otplib (TOTP) |
| Container | Docker, Docker Compose |

## 📅 Development Status

- [x] Requirements & Research
- [x] Documentation
- [x] Project Scaffolding
- [x] Authentication & MFA
- [x] Core Post Management
- [x] Platform Integrations
- [x] Scheduling System
- [x] Quota Management
- [ ] UI/UX (ongoing polish)
- [x] Docker Deployment
- [ ] Testing

## 🚀 Getting Started

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

3. **Build and start**
   ```bash
   scripts/docker-build.sh
   scripts/docker-up.sh
   ```

4. **Open the app**
   - Web UI: http://localhost:8080
   - API: http://localhost:8080/api

### Project Structure

```
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

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

## 🤝 Contributing

This project is currently in early development. Contribution guidelines will be added once the core functionality is stable.

---

*Last Updated: January 26, 2026*
