# Product Requirements Document (PRD)
## Auto-PostIt - Self-Hosted Social Media Scheduler

**Version:** 1.1  
**Date:** January 12, 2026  
**Author:** Development Team

---

## 1. Executive Summary

**Auto-PostIt** is a minimalist, self-hosted social media scheduling and auto-posting application designed for single-user operation. It aims to be a simpler alternative to Postiz, focusing on ease of use, reliability, and staying within free API tier limits for individual accounts.

### 1.1 Primary Use Case

**Music Label Promotion** - This application will be used for business purposes to promote and post content about a music label. All social media accounts connected will be business/professional accounts, making the Facebook Pages-only limitation perfectly acceptable.

---

## 2. Research Findings - Platform API Feasibility

### 2.1 X (Twitter) API
| Aspect | Details |
|--------|---------|
| **Free Tier** | ✅ Available |
| **Post Limit** | 100 posts/month (Free), 15,000/month ($200 Basic) |
| **API Version** | v2 (recommended) |
| **Auth Method** | OAuth 2.0 with PKCE |
| **Media Support** | Images, Videos, GIFs |
| **Feasibility** | ✅ **FEASIBLE** - Free tier sufficient for personal use (~3 posts/day) |

### 2.2 LinkedIn API
| Aspect | Details |
|--------|---------|
| **Free Access** | ✅ Available via "Share on LinkedIn" product |
| **Permissions Required** | `w_member_social` (post on behalf of member) |
| **API** | Posts API (REST) |
| **Media Support** | Text, Images, Videos, Documents, Articles |
| **Rate Limits** | Standard API rate limits apply |
| **Feasibility** | ✅ **FEASIBLE** - Need to create LinkedIn App and get approved |

### 2.3 Facebook (Pages) API
| Aspect | Details |
|--------|---------|
| **Free Access** | ✅ Available |
| **Requirement** | Must post to a **Facebook Page** (not personal profile) |
| **Permissions** | `pages_manage_posts`, `pages_read_engagement` |
| **Auth** | Facebook Login for Business |
| **Media Support** | Text, Images, Videos, Links |
| **App Review** | Required for production use |
| **Feasibility** | ✅ **FEASIBLE** - Pages only, perfect for business/music label use |

### 2.4 Instagram API
| Aspect | Details |
|--------|---------|
| **Free Access** | ✅ Available |
| **Requirement** | **Professional Account** (Business/Creator) connected to Facebook Page |
| **Rate Limit** | 100 posts per 24 hours |
| **Media Support** | Images (JPEG only), Videos, Reels, Carousels, Stories |
| **Limitations** | No filters, no shopping tags, media must be on public URL |
| **Feasibility** | ✅ **FEASIBLE** - Requires professional account setup |

### 2.5 YouTube API
| Aspect | Details |
|--------|---------|
| **Free Access** | ✅ Available |
| **Default Quota** | 10,000 units/day |
| **Upload Cost** | 100 units per video upload |
| **Daily Uploads** | ~100 videos/day within free quota |
| **Auth** | OAuth 2.0 |
| **Feasibility** | ✅ **FEASIBLE** - Generous free quota for personal use |

### 2.6 Pinterest API
| Aspect | Details |
|--------|---------|
| **Free Access** | ✅ Available (Trial access) |
| **Requirement** | Business account, App approval process |
| **Capabilities** | Create, edit, delete Pins and boards |
| **Auth** | OAuth 2.0 |
| **Feasibility** | ✅ **FEASIBLE** - Requires business account and app approval |

---

## 3. Feasibility Summary

| Platform | Feasibility | Notes |
|----------|-------------|-------|
| X (Twitter) | ✅ Yes | Free tier = 100 posts/month |
| LinkedIn | ✅ Yes | Personal account posting supported |
| Facebook | ✅ Yes | Pages only (ideal for business/music label use) |
| Instagram | ✅ Yes | Requires Professional account |
| YouTube | ✅ Yes | Generous quota for uploads |
| Pinterest | ✅ Yes | Requires business account |

**Verdict: ✅ THIS PROJECT IS FEASIBLE**

---

## 4. Product Goals

1. **Simplicity** - Single-user focused, minimal configuration
2. **Self-Hosted** - Full control over data, Docker-based deployment
3. **Free Operation** - Stay within free API tiers with real-time quota tracking
4. **Reliability** - Queue-based scheduling with retry logic
5. **Minimalist UI** - Clean, fast, functional interface
6. **Security-First** - TOTP-based MFA, route protection, bot mitigation
7. **API Efficiency** - Minimize unnecessary API calls, track usage per platform

---

## 5. Core Features

### 5.1 Post Management
- [ ] Create posts with text, images, and videos
- [ ] Preview posts before scheduling
- [ ] Edit/delete scheduled posts
- [ ] Post history and analytics view

### 5.2 Scheduling
- [ ] Calendar-based scheduling interface
- [ ] Timezone support
- [ ] Recurring posts (optional)
- [ ] Queue management with drag-and-drop reordering

### 5.3 Multi-Platform Posting
- [ ] Select multiple platforms per post
- [ ] Platform-specific content adaptation
- [ ] Character count validation per platform
- [ ] Media format validation

### 5.4 Platform Integrations
- [ ] X (Twitter) - OAuth 2.0, v2 API
- [ ] LinkedIn - OAuth 2.0, Posts API
- [ ] Facebook Pages - OAuth 2.0, Graph API
- [ ] Instagram - OAuth 2.0, Content Publishing API
- [ ] YouTube - OAuth 2.0, Data API v3
- [ ] Pinterest - OAuth 2.0, REST API v5

### 5.5 Media Management
- [ ] Image upload and storage
- [ ] Video upload with progress indicator
- [ ] Media library for reuse
- [ ] Automatic format conversion (if needed)

### 5.6 Account Management
- [ ] Connect/disconnect social accounts
- [ ] Token refresh handling
- [ ] Connection status monitoring
- [ ] Rate limit tracking per platform

### 5.7 Authentication & Security
- [ ] Email/password authentication with secure hashing (Argon2)
- [ ] TOTP-based Multi-Factor Authentication (MFA)
- [ ] QR code generation for authenticator app setup
- [ ] Backup/recovery codes for MFA
- [ ] Session management with secure tokens
- [ ] Account lockout after failed attempts
- [ ] Login attempt logging and alerts

### 5.8 API Quota Management
- [ ] Real-time quota tracking per platform
- [ ] Visual quota usage dashboard
- [ ] Automatic posting prevention when near limits
- [ ] Quota reset countdown timers
- [ ] Historical usage analytics
- [ ] Warning notifications at 80% usage

---

## 6. Technical Architecture

### 6.1 Tech Stack

| Component | Technology | License | Rationale |
|-----------|------------|---------|-----------|
| **Backend** | Node.js + Express.js | MIT | Mature, extensive OAuth libraries |
| **Frontend** | React + Vite | MIT | Fast, modern, great DX |
| **Database** | SQLite (dev) / PostgreSQL (prod) | Public Domain / PostgreSQL | Simple, reliable, no separate server for SQLite |
| **Queue** | BullMQ + Redis | MIT | Robust job scheduling with retries |
| **ORM** | Prisma | Apache 2.0 | Type-safe, great migrations |
| **Auth** | Passport.js + otplib | MIT | Extensive OAuth strategy support + TOTP |
| **UI Framework** | Tailwind CSS + shadcn/ui | MIT | Modern, customizable |
| **File Storage** | Local filesystem / S3-compatible | - | Flexible storage options |
| **Container** | Docker + Docker Compose | Apache 2.0 | Easy deployment |

### 6.2 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Apache2 Reverse Proxy                    │
│                     (SSL Termination, Domain Routing)            │
└─────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │  Frontend │   │  Backend  │   │   Redis   │
            │  (React)  │   │ (Express) │   │  (Queue)  │
            │  :3000    │   │  :4000    │   │  :6379    │
            └───────────┘   └─────┬─────┘   └───────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │ PostgreSQL│   │   Media   │   │  Social   │
            │  Database │   │  Storage  │   │   APIs    │
            │  :5432    │   │  (local)  │   │           │
            └───────────┘   └───────────┘   └───────────┘
```

### 6.3 Directory Structure

```
auto-postit/
├── docker/
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   └── docker-compose.yml
├── backend/
│   ├── src/
│   │   ├── config/           # Configuration files
│   │   ├── controllers/      # Route handlers
│   │   ├── services/         # Business logic
│   │   │   ├── platforms/    # Platform-specific services
│   │   │   │   ├── twitter.service.ts
│   │   │   │   ├── linkedin.service.ts
│   │   │   │   ├── facebook.service.ts
│   │   │   │   ├── instagram.service.ts
│   │   │   │   ├── youtube.service.ts
│   │   │   │   └── pinterest.service.ts
│   │   │   ├── scheduler.service.ts
│   │   │   └── media.service.ts
│   │   ├── jobs/             # BullMQ job processors
│   │   ├── middleware/       # Express middleware
│   │   ├── routes/           # API routes
│   │   ├── utils/            # Utility functions
│   │   └── index.ts          # Entry point
│   ├── prisma/
│   │   └── schema.prisma     # Database schema
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom hooks
│   │   ├── services/         # API client
│   │   ├── store/            # State management
│   │   └── main.tsx          # Entry point
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   └── PRD.md
├── .env.example
└── README.md
```

---

## 7. Database Schema (Prisma)

```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  password        String    // Argon2id hashed
  mfaEnabled      Boolean   @default(false)
  mfaSecret       String?   // Encrypted TOTP secret
  mfaBackupCodes  String?   // Encrypted JSON array of backup codes
  failedAttempts  Int       @default(0)
  lockedUntil     DateTime?
  lastLoginAt     DateTime?
  lastLoginIp     String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  accounts        SocialAccount[]
  posts           Post[]
  media           Media[]
  sessions        Session[]
  auditLogs       AuditLog[]
}

model Session {
  id           String   @id @default(cuid())
  token        String   @unique
  userAgent    String?
  ipAddress    String?
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model AuditLog {
  id        String   @id @default(cuid())
  action    String   // LOGIN, LOGOUT, MFA_SETUP, MFA_VERIFY, FAILED_LOGIN, etc.
  ipAddress String?
  userAgent String?
  metadata  Json?
  createdAt DateTime @default(now())
  
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
}

model SocialAccount {
  id           String   @id @default(cuid())
  platform     Platform
  platformId   String
  accessToken  String   // AES-256-GCM encrypted
  refreshToken String?  // AES-256-GCM encrypted
  expiresAt    DateTime?
  metadata     Json?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  postTargets  PostTarget[]
  quotaUsage   QuotaUsage[]
  
  @@unique([userId, platform])
}

model QuotaUsage {
  id          String   @id @default(cuid())
  platform    Platform
  action      String   // POST, UPLOAD, READ, etc.
  cost        Int      // Quota units consumed
  resetAt     DateTime // When quota resets
  createdAt   DateTime @default(now())
  
  accountId   String
  account     SocialAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  
  @@index([accountId, platform, createdAt])
}

model Post {
  id          String     @id @default(cuid())
  content     String
  scheduledAt DateTime?
  publishedAt DateTime?
  status      PostStatus @default(DRAFT)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  
  userId      String
  user        User       @relation(fields: [userId], references: [id])
  targets     PostTarget[]
  attachments PostMedia[]
}

model PostTarget {
  id        String       @id @default(cuid())
  status    TargetStatus @default(PENDING)
  platformPostId String?
  error     String?
  publishedAt DateTime?
  
  postId    String
  post      Post         @relation(fields: [postId], references: [id])
  accountId String
  account   SocialAccount @relation(fields: [accountId], references: [id])
  
  @@unique([postId, accountId])
}

model Media {
  id        String    @id @default(cuid())
  filename  String
  mimetype  String
  size      Int
  url       String
  createdAt DateTime  @default(now())
  
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  posts     PostMedia[]
}

model PostMedia {
  postId  String
  mediaId String
  order   Int      @default(0)
  
  post    Post     @relation(fields: [postId], references: [id])
  media   Media    @relation(fields: [mediaId], references: [id])
  
  @@id([postId, mediaId])
}

enum Platform {
  TWITTER
  LINKEDIN
  FACEBOOK
  INSTAGRAM
  YOUTUBE
  PINTEREST
}

enum PostStatus {
  DRAFT
  SCHEDULED
  PUBLISHING
  PUBLISHED
  FAILED
  PARTIAL
}

enum TargetStatus {
  PENDING
  PUBLISHING
  PUBLISHED
  FAILED
}
```

---

## 8. API Endpoints

### Public Routes (No Authentication)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check for monitoring |
| POST | `/api/auth/login` | User login (rate limited) |
| POST | `/api/auth/mfa/verify` | MFA token verification |
| GET | `/api/oauth/:platform/callback` | OAuth callbacks from platforms |

### Protected Routes (Authentication Required)

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/mfa/setup` | Initialize MFA setup |
| POST | `/api/auth/mfa/enable` | Enable MFA with TOTP code |
| POST | `/api/auth/mfa/disable` | Disable MFA |
| GET | `/api/auth/mfa/backup-codes` | Get new backup codes |

#### Social Accounts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounts` | List connected accounts |
| GET | `/api/accounts/:platform/connect` | OAuth initiation |
| GET | `/api/accounts/:platform/callback` | OAuth callback |
| DELETE | `/api/accounts/:id` | Disconnect account |
| POST | `/api/accounts/:id/refresh` | Refresh token |

### Posts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posts` | List all posts |
| POST | `/api/posts` | Create new post |
| GET | `/api/posts/:id` | Get post details |
| PUT | `/api/posts/:id` | Update post |
| DELETE | `/api/posts/:id` | Delete post |
| POST | `/api/posts/:id/publish` | Publish now |
| POST | `/api/posts/:id/schedule` | Schedule post |

### Media
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/media` | List media files |
| POST | `/api/media/upload` | Upload media |
| DELETE | `/api/media/:id` | Delete media |

### Queue
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/queue/status` | Queue status |
| GET | `/api/queue/jobs` | List scheduled jobs |

### Quota Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/quota` | Get quota status for all platforms |
| GET | `/api/quota/:platform` | Get quota for specific platform |
| GET | `/api/quota/history` | Get historical usage data |

---

## 9. Platform Character & Media Limits

| Platform | Text Limit | Images | Video Length | Video Size |
|----------|------------|--------|--------------|------------|
| X (Twitter) | 280 chars | 4 images | 2:20 min | 512 MB |
| LinkedIn | 3,000 chars | 20 images | 10 min | 5 GB |
| Facebook | 63,206 chars | Multiple | 240 min | 10 GB |
| Instagram | 2,200 chars | 10 images | 60 sec (feed) | 100 MB |
| YouTube | 5,000 chars (desc) | Thumbnail | No limit | 256 GB |
| Pinterest | 500 chars | 1 image | 15 min | 2 GB |

---

## 10. Security Architecture

### 10.1 Authentication Security
| Feature | Implementation |
|---------|----------------|
| Password Hashing | Argon2id with salt |
| MFA | TOTP (RFC 6238) via otplib |
| Session Tokens | Cryptographically secure, HTTP-only cookies |
| Token Rotation | Refresh tokens rotated on use |
| Lockout Policy | 5 failed attempts = 15 min lockout |

### 10.2 Route Classification

**PUBLIC Routes** (No authentication required):
```
/api/health                    - Health check for monitoring
/api/auth/login               - Login endpoint
/api/auth/mfa/verify          - MFA verification
/api/oauth/:platform/callback - OAuth callbacks from social platforms
```

**PROTECTED Routes** (Requires valid session):
```
/api/auth/logout              - Logout
/api/auth/me                  - Current user info
/api/auth/mfa/setup           - MFA setup
/api/posts/*                  - All post operations
/api/media/*                  - All media operations
/api/accounts/*               - Account management (except callbacks)
/api/queue/*                  - Queue management
/api/quota/*                  - Quota dashboard
```

### 10.3 Security Measures

1. **Token Storage**: AES-256-GCM encryption for OAuth tokens at rest
2. **HTTPS Only**: All traffic through Apache2 with SSL/TLS 1.3
3. **Session Security**: HTTP-only, Secure, SameSite=Strict cookies
4. **Rate Limiting**: 
   - Login: 5 attempts per 15 minutes per IP
   - API: 100 requests per minute per session
   - Public routes: 20 requests per minute per IP
5. **Input Validation**: Zod schemas for all inputs, sanitization
6. **CORS**: Strict origin policy, credentials restricted
7. **CSP Headers**: Content Security Policy to prevent XSS
8. **CSRF Protection**: Double-submit cookie pattern
9. **Bot Mitigation**: 
   - Honeypot fields on login
   - Request fingerprinting
   - Suspicious pattern detection
10. **Audit Logging**: All auth events logged with IP and user agent

---

## 11. Deployment Requirements

### Minimum VPS Specifications
- **CPU**: 2 cores
- **RAM**: 2 GB
- **Storage**: 20 GB SSD
- **OS**: Ubuntu 22.04 LTS

### Docker Compose Services
1. **frontend**: React app (Nginx)
2. **backend**: Express.js API
3. **postgres**: PostgreSQL database
4. **redis**: Redis for job queue
5. **worker**: BullMQ job processor

### Apache2 Configuration
```apache
<VirtualHost *:443>
    ServerName autopostit.yourdomain.com
    
    SSLEngine on
    SSLCertificateFile /path/to/cert.pem
    SSLCertificateKeyFile /path/to/key.pem
    
    ProxyPreserveHost On
    
    # Frontend
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
    
    # API
    ProxyPass /api http://localhost:4000/api
    ProxyPassReverse /api http://localhost:4000/api
</VirtualHost>
```

---

## 12. Development Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Project scaffolding
- [ ] Database setup with Prisma
- [ ] Basic authentication
- [ ] Docker configuration

### Phase 2: Core Features (Week 3-4)
- [ ] Post creation/editing UI
- [ ] Media upload functionality
- [ ] Scheduling system with BullMQ
- [ ] Queue management

### Phase 3: Platform Integrations (Week 5-7)
- [ ] X (Twitter) integration
- [ ] LinkedIn integration
- [ ] Facebook Pages integration
- [ ] Instagram integration
- [ ] YouTube integration
- [ ] Pinterest integration

### Phase 4: Polish & Deploy (Week 8)
- [ ] UI/UX improvements
- [ ] Error handling & logging
- [ ] Documentation
- [ ] Production deployment

---

## 13. Out of Scope (v1.0)

- Multi-user/team support
- Analytics dashboard
- AI caption generation
- URL shortener
- Comment management
- Content calendar templates
- Mobile app

---

## 14. Success Criteria

1. Successfully post to all 6 platforms
2. Scheduled posts execute within 1 minute of target time
3. 99% uptime for self-hosted instance
4. All operations stay within free API tiers
5. Complete setup in under 30 minutes

---

## 15. Open Questions

1. ~~Should we support Threads (Meta's Twitter alternative)?~~ - Future consideration
2. ~~Do we need Bluesky integration?~~ - Future consideration
3. ~~Should analytics be included in v1.0?~~ - Basic quota analytics included
4. ~~Support for TikTok?~~ - Future consideration

---

## 16. Related Documentation

| Document | Purpose |
|----------|---------|
| [SECURITY.md](./SECURITY.md) | Security architecture, authentication, encryption standards |
| [PLATFORM_LIMITS.md](./PLATFORM_LIMITS.md) | API quotas, rate limits, content restrictions per platform |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, route design, deployment configuration |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Coding standards, testing, git workflow |
| [.env.example](../.env.example) | Environment variables template |

---

## 17. Approval

**Please review this PRD and confirm:**
- [ ] Platform selection is acceptable
- [ ] Tech stack is approved
- [ ] Feature scope is appropriate
- [ ] Timeline expectations are realistic

Once approved, we will proceed with project scaffolding.
