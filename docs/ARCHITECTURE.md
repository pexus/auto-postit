# Architecture Guide
## Auto-PostIt - System Architecture & Route Design

> **CRITICAL**: This document defines the application architecture.
> All implementations MUST follow this structure for security and maintainability.

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                         │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Apache2 Reverse Proxy                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  • SSL/TLS 1.3 Termination                                             │  │
│  │  • Rate Limiting (mod_ratelimit)                                       │  │
│  │  • Security Headers                                                     │  │
│  │  • Request Logging                                                      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│     Frontend        │  │      Backend        │  │    Worker Service   │
│     Container       │  │      Container      │  │     Container       │
│  ┌───────────────┐  │  │  ┌───────────────┐  │  │  ┌───────────────┐  │
│  │  React App    │  │  │  │  Express.js   │  │  │  │   BullMQ      │  │
│  │  (Nginx)      │  │  │  │  REST API     │  │  │  │   Processor   │  │
│  │  Port: 3000   │  │  │  │  Port: 4000   │  │  │  │               │  │
│  └───────────────┘  │  │  └───────────────┘  │  │  └───────────────┘  │
└─────────────────────┘  └─────────┬───────────┘  └─────────┬───────────┘
                                   │                        │
                    ┌──────────────┼────────────────────────┤
                    ▼              ▼                        ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│    PostgreSQL       │  │       Redis         │  │    Media Storage    │
│    Container        │  │      Container      │  │     (Volume)        │
│  ┌───────────────┐  │  │  ┌───────────────┐  │  │  ┌───────────────┐  │
│  │  Database     │  │  │  │  Job Queue    │  │  │  │  /app/uploads │  │
│  │  Port: 5432   │  │  │  │  Cache        │  │  │  │               │  │
│  │  (Internal)   │  │  │  │  Port: 6379   │  │  │  │  (Persistent) │  │
│  └───────────────┘  │  │  └───────────────┘  │  │  └───────────────┘  │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

---

## 2. Network Security Design

### 2.1 Container Network Isolation

```yaml
# docker-compose.yml network design

networks:
  # Public-facing network (frontend + backend)
  frontend:
    driver: bridge
  
  # Internal services only (db, redis)
  backend:
    driver: bridge
    internal: true  # No external access

services:
  frontend:
    networks:
      - frontend
  
  backend:
    networks:
      - frontend   # Receives requests
      - backend    # Accesses DB/Redis
  
  worker:
    networks:
      - backend    # Only internal access
  
  postgres:
    networks:
      - backend    # Internal only - NOT exposed
  
  redis:
    networks:
      - backend    # Internal only - NOT exposed
```

### 2.2 Port Exposure

| Service | Internal Port | External Exposure | Notes |
|---------|---------------|-------------------|-------|
| Frontend (Nginx) | 3000 | Yes (via Apache2) | Serves React app |
| Backend (Express) | 4000 | Yes (via Apache2) | API endpoints |
| PostgreSQL | 5432 | **NO** | Internal only |
| Redis | 6379 | **NO** | Internal only |
| Worker | N/A | **NO** | No HTTP interface |

---

## 3. Backend Directory Structure

```
backend/
├── src/
│   ├── index.ts                    # Application entry point
│   │
│   ├── config/
│   │   └── env.ts                  # Environment configuration
│   │
│   ├── lib/
│   │   ├── prisma.ts               # Prisma client
│   │   ├── redis.ts                # Redis client
│   │   ├── encryption.ts           # Token encryption helpers
│   │   └── logger.ts               # Logger
│   │
│   ├── middleware/
│   │   ├── auth.ts                 # Session validation
│   │   ├── errorHandler.ts         # Global error handler
│   │   ├── requestLogger.ts        # Request logging
│   │   └── validate.ts             # Zod validation
│   │
│   ├── routes/
│   │   ├── api/                    # Authenticated API routes
│   │   │   ├── index.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── media.ts
│   │   │   ├── platforms.ts
│   │   │   ├── posts.ts
│   │   │   ├── quota.ts
│   │   │   ├── settings.ts
│   │   │   └── ai.ts
│   │   ├── auth.ts                 # Auth + MFA
│   │   ├── health.ts               # Health checks
│   │   ├── import.ts               # CSV/XLSX import
│   │   └── public.ts               # Public OAuth callbacks
│   │
│   ├── schemas/
│   │   ├── auth.schema.ts
│   │   └── import.schema.ts
│   │
│   └── services/
│       ├── auth.service.ts
│       ├── mfa.service.ts
│       ├── post.service.ts
│       ├── publish.service.ts
│       ├── platform.service.ts
│       ├── media.service.ts
│       ├── import.service.ts
│       ├── twitter.service.ts
│       ├── linkedin.service.ts
│       ├── facebook.service.ts
│       ├── pinterest.service.ts
│       ├── youtube.service.ts
│       ├── ai.service.ts
│       └── audit.service.ts
│
├── prisma/
│   └── schema.prisma
│
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 4. Route Architecture

### 4.1 Public Routes (No Authentication)

```typescript
// src/routes/public/index.ts

import { Router } from 'express';
import { publicRateLimiter } from '@/middleware/rateLimit.middleware';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import oauthRoutes from './oauth.routes';

const router = Router();

// Apply strict rate limiting to ALL public routes
router.use(publicRateLimiter);

// Health check - for monitoring
router.use('/health', healthRoutes);

// Authentication - login, MFA verify
router.use('/auth', authRoutes);

// OAuth callbacks - from social platforms
router.use('/oauth', oauthRoutes);

export default router;
```

#### Public Route Definitions

```typescript
// src/routes/public/health.routes.ts
router.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// src/routes/public/auth.routes.ts
router.post('/login', 
  loginRateLimiter,
  honeypotCheck,
  validate(loginSchema),
  authController.login
);

router.post('/mfa/verify',
  loginRateLimiter,
  validate(mfaVerifySchema),
  authController.verifyMfa
);

// src/routes/public/oauth.routes.ts
// These MUST be public - platforms redirect here
router.get('/:platform/callback',
  validate(oauthCallbackSchema),
  oauthController.handleCallback
);
```

### 4.2 Protected Routes (Authentication Required)

```typescript
// src/routes/protected/index.ts

import { Router } from 'express';
import { authMiddleware } from '@/middleware/auth.middleware';
import { mfaMiddleware } from '@/middleware/mfa.middleware';
import { csrfMiddleware } from '@/middleware/csrf.middleware';
import { apiRateLimiter } from '@/middleware/rateLimit.middleware';

const router = Router();

// ALL protected routes require:
// 1. Valid session (authMiddleware)
// 2. MFA verified (mfaMiddleware)
// 3. CSRF token (csrfMiddleware) - for state-changing requests
// 4. Rate limiting (apiRateLimiter)

router.use(authMiddleware);
router.use(mfaMiddleware);
router.use(apiRateLimiter);

// CSRF only on state-changing methods
router.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return csrfMiddleware(req, res, next);
  }
  next();
});

// Mount protected route handlers
router.use('/auth', userRoutes);      // logout, profile, MFA setup
router.use('/posts', postsRoutes);
router.use('/media', mediaRoutes);
router.use('/accounts', accountsRoutes);
router.use('/queue', queueRoutes);
router.use('/quota', quotaRoutes);

export default router;
```

### 4.3 Route Registration

```typescript
// src/routes/index.ts

import { Router } from 'express';
import publicRoutes from './public';
import protectedRoutes from './protected';

const router = Router();

// Public routes - NO authentication
router.use('/api', publicRoutes);

// Protected routes - REQUIRES authentication
router.use('/api', protectedRoutes);

export default router;
```

---

## 5. Middleware Chain

### 5.1 Global Middleware Order

```typescript
// src/app.ts

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { requestLogger } from '@/middleware/logger.middleware';
import { errorHandler } from '@/middleware/error.middleware';
import routes from '@/routes';

const app = express();

// 1. Security headers (first!)
app.use(helmet(helmetConfig));

// 2. CORS
app.use(cors(corsConfig));

// 3. Request logging (for audit)
app.use(requestLogger);

// 4. Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 5. Cookie parsing
app.use(cookieParser());

// 6. Routes (includes route-specific middleware)
app.use(routes);

// 7. 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// 8. Global error handler (last!)
app.use(errorHandler);

export default app;
```

### 5.2 Authentication Middleware

```typescript
// src/middleware/auth.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { SessionService } from '@/services/session.service';

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const sessionToken = req.cookies.session;
    
    if (!sessionToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const session = await SessionService.validate(sessionToken);
    
    if (!session) {
      res.clearCookie('session');
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    
    // Attach user to request
    req.user = session.user;
    req.session = session;
    
    next();
  } catch (error) {
    next(error);
  }
}
```

### 5.3 MFA Middleware

```typescript
// src/middleware/mfa.middleware.ts

export async function mfaMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = req.user!;
  
  // If MFA is enabled, verify it was completed for this session
  if (user.mfaEnabled && !req.session.mfaVerified) {
    return res.status(403).json({
      error: 'MFA verification required',
      code: 'MFA_REQUIRED',
    });
  }
  
  next();
}
```

---

## 6. Frontend Architecture

```
frontend/
├── src/
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Root component
│   ├── router.tsx                  # React Router setup
│   │
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── MfaVerify.tsx
│   │   ├── MfaSetup.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Posts/
│   │   │   ├── List.tsx
│   │   │   ├── Create.tsx
│   │   │   ├── Edit.tsx
│   │   │   └── Calendar.tsx
│   │   ├── Accounts/
│   │   │   ├── List.tsx
│   │   │   └── Connect.tsx
│   │   ├── Media/
│   │   │   └── Library.tsx
│   │   └── Settings/
│   │       ├── Profile.tsx
│   │       └── Security.tsx
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Layout.tsx
│   │   ├── posts/
│   │   │   ├── PostForm.tsx
│   │   │   ├── PostPreview.tsx
│   │   │   └── PlatformSelector.tsx
│   │   ├── quota/
│   │   │   ├── QuotaCard.tsx
│   │   │   └── QuotaDashboard.tsx
│   │   └── auth/
│   │       ├── LoginForm.tsx
│   │       ├── MfaForm.tsx
│   │       └── ProtectedRoute.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── usePosts.ts
│   │   ├── useAccounts.ts
│   │   ├── useQuota.ts
│   │   └── useCsrf.ts
│   │
│   ├── services/
│   │   ├── api.ts                  # Axios instance
│   │   ├── auth.api.ts
│   │   ├── posts.api.ts
│   │   ├── media.api.ts
│   │   └── accounts.api.ts
│   │
│   ├── store/
│   │   ├── index.ts                # Zustand store
│   │   ├── authSlice.ts
│   │   └── uiSlice.ts
│   │
│   ├── lib/
│   │   ├── utils.ts
│   │   └── constants.ts
│   │
│   └── types/
│       └── index.ts
│
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

## 7. Job Queue Architecture

> **Status (Jan 2026):** Background workers/queues are planned but not yet implemented in the current codebase. Scheduled posts are stored in the database and require a future worker/cron to publish automatically.

### 7.1 Queue Design

```typescript
// src/config/queue.ts

import { Queue, Worker, QueueScheduler } from 'bullmq';
import { redisConnection } from './redis';

// Queue definitions
export const publishQueue = new Queue('publish', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const tokenRefreshQueue = new Queue('token-refresh', {
  connection: redisConnection,
});

// Scheduled jobs
export const scheduledJobs = [
  {
    name: 'check-expiring-tokens',
    cron: '*/15 * * * *', // Every 15 minutes
    queue: tokenRefreshQueue,
  },
  {
    name: 'quota-alerts',
    cron: '0 * * * *', // Every hour
    queue: publishQueue,
  },
];
```

### 7.2 Job Processing

```typescript
// src/jobs/publish.job.ts

import { Job } from 'bullmq';
import { PlatformService } from '@/services/platforms';
import { QuotaService } from '@/services/quota.service';

interface PublishJobData {
  postId: string;
  targetId: string;
  platform: Platform;
  accountId: string;
}

export async function processPublishJob(job: Job<PublishJobData>) {
  const { postId, targetId, platform, accountId } = job.data;
  
  // 1. Check quota before attempting
  const quotaCheck = await QuotaService.canPerformAction(
    accountId,
    platform,
    getPublishCost(platform)
  );
  
  if (!quotaCheck.allowed) {
    throw new Error(`Quota exceeded: ${quotaCheck.reason}`);
  }
  
  // 2. Get platform service
  const platformService = PlatformService.get(platform);
  
  // 3. Publish
  const result = await platformService.publish(postId, accountId);
  
  // 4. Record quota usage
  await QuotaService.recordUsage(
    accountId,
    platform,
    'PUBLISH',
    getPublishCost(platform)
  );
  
  // 5. Update target status
  await updatePostTarget(targetId, {
    status: 'PUBLISHED',
    platformPostId: result.id,
    publishedAt: new Date(),
  });
  
  return result;
}
```

---

## 8. Data Flow Diagrams

### 8.1 Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│  Apache2 │────▶│  Backend │────▶│ Database │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     │  POST /login   │                │                │
     │───────────────▶│───────────────▶│                │
     │                │                │  Find user     │
     │                │                │───────────────▶│
     │                │                │◀───────────────│
     │                │                │                │
     │                │                │  Verify pass   │
     │                │                │  Check lockout │
     │                │                │                │
     │                │  MFA_REQUIRED  │                │
     │◀───────────────│◀───────────────│                │
     │                │                │                │
     │ POST /mfa/verify               │                │
     │───────────────▶│───────────────▶│                │
     │                │                │  Verify TOTP   │
     │                │                │  Create session│
     │                │                │───────────────▶│
     │                │                │◀───────────────│
     │                │  Set-Cookie    │                │
     │◀───────────────│◀───────────────│                │
     │                │                │                │
```

### 8.2 Post Scheduling Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│  Backend │────▶│  Redis   │────▶│  Worker  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     │ POST /posts    │                │                │
     │  (schedule)    │                │                │
     │───────────────▶│                │                │
     │                │  Validate      │                │
     │                │  quota         │                │
     │                │───────────────▶│                │
     │                │◀───────────────│                │
     │                │                │                │
     │                │  Save post     │                │
     │                │  (SCHEDULED)   │                │
     │                │                │                │
     │                │  Add to queue  │                │
     │                │  (delayed)     │                │
     │                │───────────────▶│                │
     │                │                │                │
     │  200 OK        │                │                │
     │◀───────────────│                │                │
     │                │                │                │
     │                │                │  At scheduled  │
     │                │                │  time:         │
     │                │                │───────────────▶│
     │                │                │                │
     │                │                │  Process job   │
     │                │                │  Publish to    │
     │                │                │  platforms     │
     │                │                │                │
```

---

## 9. Error Handling Strategy

### 9.1 Error Response Format

```typescript
// All API errors follow this format
interface ApiError {
  error: string;           // Human-readable message
  code?: string;           // Machine-readable code
  details?: unknown;       // Additional context
  requestId?: string;      // For debugging
}

// Error codes
const ERROR_CODES = {
  AUTH_REQUIRED: 'Authentication required',
  MFA_REQUIRED: 'MFA verification required',
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_LOCKED: 'Account temporarily locked',
  QUOTA_EXCEEDED: 'Platform quota exceeded',
  VALIDATION_ERROR: 'Request validation failed',
  PLATFORM_ERROR: 'Social platform error',
  RATE_LIMITED: 'Too many requests',
};
```

### 9.2 Global Error Handler

```typescript
// src/middleware/error.middleware.ts

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = req.headers['x-request-id'] || generateRequestId();
  
  // Log error (but not to client)
  logger.error('Request error', {
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
  });
  
  // Don't leak internal errors to client
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      requestId,
    });
  }
  
  // Generic error response
  res.status(500).json({
    error: 'An unexpected error occurred',
    requestId,
  });
}
```

---

## 10. Deployment Configuration

### 10.1 Docker Compose

```yaml
# docker-compose.yml

version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend
    networks:
      - frontend
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/autopostit
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - uploads:/app/uploads
    networks:
      - frontend
      - backend
    restart: unless-stopped

  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: npm run worker
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/autopostit
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - uploads:/app/uploads
    networks:
      - backend
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=autopostit
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - backend
    restart: unless-stopped
    # NOT exposed to host!

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - backend
    restart: unless-stopped
    # NOT exposed to host!

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true

volumes:
  postgres_data:
  redis_data:
  uploads:
```

### 10.2 Apache2 Configuration

```apache
# /etc/apache2/sites-available/autopostit.conf

<VirtualHost *:80>
    ServerName autopostit.yourdomain.com
    RewriteEngine On
    RewriteRule ^(.*)$ https://%{HTTP_HOST}$1 [R=301,L]
</VirtualHost>

<VirtualHost *:443>
    ServerName autopostit.yourdomain.com
    
    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/autopostit.yourdomain.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/autopostit.yourdomain.com/privkey.pem
    
    # Modern SSL settings
    SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1
    SSLCipherSuite ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256
    SSLHonorCipherOrder off
    
    # Security Headers
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "DENY"
    Header always set X-XSS-Protection "1; mode=block"
    
    # Rate limiting (mod_ratelimit)
    <Location /api/auth/login>
        SetOutputFilter RATE_LIMIT
        SetEnv rate-limit 5
    </Location>
    
    # Proxy settings
    ProxyPreserveHost On
    ProxyRequests Off
    
    # API routes -> Backend
    ProxyPass /api http://localhost:4000/api
    ProxyPassReverse /api http://localhost:4000/api
    
    # Frontend -> Nginx
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
    
    # Logging
    ErrorLog ${APACHE_LOG_DIR}/autopostit_error.log
    CustomLog ${APACHE_LOG_DIR}/autopostit_access.log combined
</VirtualHost>
```

---

*Last Updated: January 12, 2026*
