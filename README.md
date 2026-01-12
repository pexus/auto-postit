# Auto-PostIt

> 🚧 **WORK IN PROGRESS** - This project is currently under active development and is not yet ready for production use.

A minimalist, self-hosted social media scheduling and auto-posting application designed for single-user operation. A simpler alternative to Postiz, focusing on ease of use, reliability, and staying within free API tier limits.

## 🎯 Purpose

Built for small business owners, content creators, and music labels who need a simple, self-hosted solution to schedule and publish content across multiple social media platforms without the complexity of enterprise SaaS tools.

## ✨ Planned Features

- **Multi-Platform Support**: X (Twitter), LinkedIn, Facebook Pages, Instagram, YouTube, Pinterest
- **Scheduling**: Calendar-based scheduling with timezone support
- **Media Management**: Upload and manage images and videos
- **Quota Tracking**: Real-time API usage monitoring to stay within free tiers
- **Security-First**: TOTP-based MFA, encrypted token storage, rate limiting
- **Self-Hosted**: Docker-based deployment with Apache2 reverse proxy

## 📋 Documentation

| Document | Description |
|----------|-------------|
| [PRD.md](docs/PRD.md) | Product Requirements Document |
| [SECURITY.md](docs/SECURITY.md) | Security architecture and guidelines |
| [PLATFORM_LIMITS.md](docs/PLATFORM_LIMITS.md) | API quotas and rate limits per platform |
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
- [ ] Authentication & MFA
- [ ] Core Post Management
- [ ] Platform Integrations
- [ ] Scheduling System
- [ ] Quota Management
- [ ] UI/UX
- [ ] Docker Deployment
- [ ] Testing

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.0.0
- Docker & Docker Compose
- Git

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/pexus/auto-postit.git
   cd auto-postit
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Start database services**
   ```bash
   npm run docker:dev
   ```

4. **Configure environment**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your settings
   ```

5. **Run database migrations**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

6. **Start development servers**
   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

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

*Last Updated: January 12, 2026*
