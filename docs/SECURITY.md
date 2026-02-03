# Security Guidelines
## Auto-PostIt Security Architecture

> **IMPORTANT**: This document defines security requirements for the Auto-PostIt application.
> All code contributions MUST adhere to these guidelines.

---

## 1. Authentication System

### 1.1 Password Security

```typescript
// REQUIRED: Use Argon2id for password hashing
import { hash, verify } from '@node-rs/argon2';

const ARGON2_OPTIONS = {
  memoryCost: 65536,    // 64 MB
  timeCost: 3,          // 3 iterations
  parallelism: 4,       // 4 parallel threads
  outputLen: 32,        // 32 bytes output
};

// Hash password
const hashedPassword = await hash(password, ARGON2_OPTIONS);

// Verify password
const isValid = await verify(hashedPassword, password);
```

### 1.2 TOTP Multi-Factor Authentication (MFA)

```typescript
// REQUIRED: Use otplib for TOTP
import { authenticator } from 'otplib';

// Configure TOTP
authenticator.options = {
  digits: 6,
  step: 30,        // 30-second window
  window: 1,       // Allow 1 step tolerance
};

// Generate secret for new MFA setup
const secret = authenticator.generateSecret();

// Generate QR code URI
const otpauth = authenticator.keyuri(email, 'Auto-PostIt', secret);

// Verify TOTP token
const isValid = authenticator.verify({ token, secret });
```

### 1.3 Backup Codes

```typescript
// Generate 10 backup codes on MFA setup
import { randomBytes } from 'crypto';

function generateBackupCodes(count: number = 10): string[] {
  return Array.from({ length: count }, () => 
    randomBytes(4).toString('hex').toUpperCase()
  );
}

// Store encrypted, mark as used when consumed
```

### 1.4 Session Management

```typescript
// Session token generation
import { randomBytes } from 'crypto';

const sessionToken = randomBytes(32).toString('hex');

// Session cookie settings (REQUIRED)
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,       // Prevent XSS access
  secure: true,         // HTTPS only
  sameSite: 'strict',   // Prevent CSRF
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/',
};
```

---

## 2. Route Protection Architecture

### 2.1 Route Classification

```typescript
// routes/index.ts - Route registration pattern

// PUBLIC ROUTES - No authentication required
// These are exposed to the internet and must be hardened
const publicRoutes = [
  'GET  /api/health',                     // Health check
  'POST /api/auth/login',                 // Login
  'POST /api/auth/mfa/verify',            // MFA verification
  'GET  /api/oauth/:platform/callback',   // OAuth callbacks
];

// PROTECTED ROUTES - Require valid session
// All other routes default to protected
const protectedRoutes = [
  '/api/auth/logout',
  '/api/auth/me',
  '/api/auth/mfa/*',
  '/api/posts/*',
  '/api/media/*',
  '/api/accounts/*',
  '/api/queue/*',
  '/api/quota/*',
];
```

### 2.2 Middleware Stack (Order Matters!)

```typescript
// Apply middleware in this exact order
app.use(helmet());                    // Security headers
app.use(cors(corsOptions));           // CORS
app.use(rateLimiter);                 // Rate limiting
app.use(requestLogger);               // Audit logging
app.use(cookieParser());              // Parse cookies
app.use(express.json({ limit: '10mb' }));
app.use(csrfProtection);              // CSRF protection
app.use(sanitizeInput);               // Input sanitization

// Route-specific middleware
app.use('/api/auth/login', loginRateLimiter);
app.use('/api', publicRouteHandler);
app.use('/api', authMiddleware, protectedRouteHandler);
```

---

## 3. Rate Limiting Configuration

### 3.1 Rate Limit Tiers

```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

// Login rate limiter - Strict
export const loginRateLimiter = rateLimit({
  store: new RedisStore({ client: redisClient }),
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                      // 5 attempts
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

// API rate limiter - Standard
export const apiRateLimiter = rateLimit({
  store: new RedisStore({ client: redisClient }),
  windowMs: 60 * 1000,        // 1 minute
  max: 100,                    // 100 requests
  message: { error: 'Too many requests. Please slow down.' },
  keyGenerator: (req) => req.session?.userId || req.ip,
});

// Public route rate limiter - Strict
export const publicRateLimiter = rateLimit({
  store: new RedisStore({ client: redisClient }),
  windowMs: 60 * 1000,        // 1 minute
  max: 20,                     // 20 requests
  message: { error: 'Rate limit exceeded.' },
  keyGenerator: (req) => req.ip,
});
```

### 3.2 Account Lockout

```typescript
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

async function handleFailedLogin(userId: string): Promise<void> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      failedAttempts: { increment: 1 },
    },
  });

  if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
      },
    });
  }
}

async function resetFailedAttempts(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
}
```

---

## 4. OAuth Token Security

### 4.1 Token Encryption

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY!; // 32 bytes

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptToken(ciphertext: string): string {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

### 4.2 Token Storage Rules

| Token Type | Storage Location | Encryption | Expiry Handling |
|------------|------------------|------------|-----------------|
| Access Token | Database | AES-256-GCM | Refresh before expiry |
| Refresh Token | Database | AES-256-GCM | Rotate on use |
| Session Token | Cookie + Database | N/A (random) | 24h expiry |
| MFA Secret | Database | AES-256-GCM | Never expires |

---

## 5. Input Validation & Sanitization

### 5.1 Zod Schemas (Required for all inputs)

```typescript
import { z } from 'zod';

// Login schema
export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  mfaToken: z.string().length(6).regex(/^\d+$/).optional(),
});

// Post creation schema
export const createPostSchema = z.object({
  content: z.string().min(1).max(10000),
  platforms: z.array(z.enum(['TWITTER', 'LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'YOUTUBE', 'PINTEREST'])).min(1),
  scheduledAt: z.string().datetime().optional(),
  mediaIds: z.array(z.string().cuid()).max(10).optional(),
});

// Validation middleware
export function validate<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          error: 'Validation failed', 
          details: error.errors 
        });
      } else {
        next(error);
      }
    }
  };
}
```

### 5.2 SQL Injection Prevention

```typescript
// ALWAYS use Prisma's parameterized queries
// NEVER construct raw SQL with string concatenation

// ✅ CORRECT
const user = await prisma.user.findUnique({
  where: { email: userInput },
});

// ❌ WRONG - NEVER DO THIS
const user = await prisma.$queryRaw`SELECT * FROM users WHERE email = '${userInput}'`;
```

### 5.3 XSS Prevention

```typescript
import DOMPurify from 'isomorphic-dompurify';

// Sanitize HTML content (if any rich text is allowed)
const sanitizedContent = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: [], // No HTML allowed for social posts
  ALLOWED_ATTR: [],
});
```

---

## 6. Security Headers

### 6.1 Helmet Configuration

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // For Tailwind
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-site" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: "deny" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
}));
```

---

## 7. CORS Configuration

```typescript
import cors from 'cors';

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      // OAuth callbacks may come without origin
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-CSRF-Token'],
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));
```

---

## 8. CSRF Protection

```typescript
import { doubleCsrf } from 'csrf-csrf';

const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET!,
  cookieName: '__csrf',
  cookieOptions: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  },
  getTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
});

// Apply to all state-changing routes
app.use('/api', doubleCsrfProtection);

// Endpoint to get CSRF token (called on page load)
app.get('/api/csrf-token', (req, res) => {
  res.json({ token: generateToken(req, res) });
});
```

---

## 9. Audit Logging

### 9.1 Events to Log

| Event | Log Level | Data Captured |
|-------|-----------|---------------|
| LOGIN_SUCCESS | INFO | userId, IP, userAgent |
| LOGIN_FAILED | WARN | email (partial), IP, userAgent, reason |
| LOGOUT | INFO | userId, IP |
| MFA_ENABLED | INFO | userId, IP |
| MFA_DISABLED | WARN | userId, IP |
| MFA_FAILED | WARN | userId, IP, attemptCount |
| PASSWORD_CHANGED | INFO | userId, IP |
| ACCOUNT_LOCKED | WARN | userId, IP, reason |
| TOKEN_REFRESH | DEBUG | platform, accountId |
| POST_PUBLISHED | INFO | postId, platforms |

### 9.2 Audit Log Implementation

```typescript
export async function auditLog(
  action: string,
  userId: string | null,
  req: Request,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action,
      userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: metadata || {},
    },
  });
  
  // Also log to application logs
  logger.info(`AUDIT: ${action}`, {
    userId,
    ip: req.ip,
    ...metadata,
  });
}
```

---

## 10. Bot Mitigation

### 10.1 Honeypot Fields

```typescript
// Add hidden field to login form
// <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off" />

export function honeypotCheck(req: Request, res: Response, next: NextFunction) {
  if (req.body.website) {
    // Bot detected - silently fail
    await auditLog('BOT_DETECTED', null, req, { reason: 'honeypot' });
    return res.status(200).json({ success: true }); // Don't reveal detection
  }
  next();
}
```

### 10.2 Request Timing Analysis

```typescript
const MIN_REQUEST_TIME_MS = 1000; // Human takes at least 1s to fill form

export function timingCheck(req: Request, res: Response, next: NextFunction) {
  const formLoadTime = parseInt(req.body._loadTime);
  const submitTime = Date.now();
  
  if (submitTime - formLoadTime < MIN_REQUEST_TIME_MS) {
    await auditLog('BOT_DETECTED', null, req, { reason: 'timing' });
    return res.status(429).json({ error: 'Please try again' });
  }
  next();
}
```

---

## 11. Environment Variables

```bash
# .env.example - Required security variables

# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/autopostit"

# Session & Encryption (Generate with: openssl rand -hex 32)
SESSION_SECRET="<64-char-hex-string>"
TOKEN_ENCRYPTION_KEY="<64-char-hex-string>"
CSRF_SECRET="<64-char-hex-string>"

# OAuth Credentials (per platform)
TWITTER_CLIENT_ID=""
TWITTER_CLIENT_SECRET=""
LINKEDIN_CLIENT_ID=""
LINKEDIN_CLIENT_SECRET=""
# ... etc

# Frontend URL (for CORS)
CORS_ORIGIN="https://autopostit.yourdomain.com"

# Rate Limiting
REDIS_URL="redis://localhost:6379"

# Media storage quotas (per user)
MEDIA_MAX_USER_STORAGE="10737418240"
```

---

## 11.1 Secret File Permissions

- Store production environment files outside the repo (for example: `/etc/auto-postit/auto-postit.env`).
- Restrict access to the owning service user (or root): `chown root:root /etc/auto-postit/auto-postit.env` and `chmod 600 /etc/auto-postit/auto-postit.env`.
- If you run Docker rootless, change the owner to the user running `docker compose` and keep `chmod 600`.
- Do not mount or bake `.env` files into container images; pass them at runtime.
- Optional helper: `scripts/lockdown-env.sh /etc/auto-postit/auto-postit.env`

## 12. Security Checklist

Before deployment, verify:

- [ ] All environment variables set with secure random values
- [ ] SSL/TLS configured on Apache2 reverse proxy
- [ ] Database not exposed to public network
- [ ] Redis not exposed to public network  
- [ ] All dependencies updated to latest secure versions
- [ ] Rate limiting tested and working
- [ ] MFA flow tested end-to-end
- [ ] CSRF protection verified
- [ ] No sensitive data in logs
- [ ] Audit logging capturing all auth events
- [ ] Error messages don't leak sensitive info
- [ ] File uploads restricted to allowed types/sizes
- [ ] Secret files are owned by root (or service user) and set to `chmod 600`
- [ ] Container images do not contain `.env` or secrets
- [ ] CI security scans are configured with appropriate visibility (GitHub Actions logs are visible to anyone with read access on public repos)

---

## 13. Incident Response

If security breach suspected:

1. **Immediately**: Rotate all secrets (SESSION_SECRET, TOKEN_ENCRYPTION_KEY)
2. **Invalidate**: All active sessions (`DELETE FROM sessions`)
3. **Revoke**: All OAuth tokens and re-authenticate
4. **Review**: Audit logs for suspicious activity
5. **Update**: Change user password and MFA secret
6. **Notify**: Assess if social accounts were compromised

---

*Last Updated: February 2, 2026*
