# Development Standards
## Auto-PostIt - Code Quality & Contribution Guidelines

> **PURPOSE**: This document defines coding standards and best practices.
> All code contributions MUST follow these guidelines.

---

## 1. Code Style

### 1.1 TypeScript Configuration

```json
// tsconfig.json (backend)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 1.2 ESLint Configuration

```javascript
// .eslintrc.cjs
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'security', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:security/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  rules: {
    // Security
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-unsafe-regex': 'error',
    
    // TypeScript
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'error',
    
    // Import order
    'import/order': ['error', {
      'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      'newlines-between': 'always',
      'alphabetize': { 'order': 'asc' },
    }],
    
    // General
    'no-console': 'error', // Use logger instead
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'prefer-const': 'error',
  },
};
```

### 1.3 Prettier Configuration

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

---

## 2. Naming Conventions

### 2.1 Files & Folders

| Type | Convention | Example |
|------|------------|---------|
| Folders | kebab-case | `platform-services/` |
| TypeScript files | camelCase | `quotaService.ts` |
| Route files | kebab-case.routes.ts | `auth.routes.ts` |
| Service files | camelCase.service.ts | `twitter.service.ts` |
| Middleware files | camelCase.middleware.ts | `auth.middleware.ts` |
| Schema files | camelCase.schema.ts | `post.schema.ts` |
| Test files | *.test.ts or *.spec.ts | `auth.service.test.ts` |
| React components | PascalCase.tsx | `PostForm.tsx` |

### 2.2 Code Elements

```typescript
// Classes - PascalCase
class QuotaService {}

// Interfaces - PascalCase with 'I' prefix (optional but consistent)
interface IPostData {}
// Or without prefix
interface PostData {}

// Types - PascalCase
type Platform = 'TWITTER' | 'LINKEDIN';

// Enums - PascalCase, values UPPER_SNAKE_CASE
enum PostStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

// Functions - camelCase
function validatePost() {}

// Variables - camelCase
const postContent = '';

// Constants - UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;

// Private class members - prefix with underscore
class Service {
  private _cache: Map<string, unknown>;
}
```

---

## 3. Code Patterns

### 3.1 Error Handling

```typescript
// ✅ CORRECT - Custom error classes
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTH_REQUIRED');
    this.name = 'AuthenticationError';
  }
}

// ✅ CORRECT - Throwing errors
async function getUser(id: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id } });
  
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }
  
  return user;
}

// ✅ CORRECT - Try-catch in controllers
async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (error) {
    next(error); // Let error middleware handle it
  }
}

// ❌ WRONG - Don't swallow errors
async function badExample() {
  try {
    await riskyOperation();
  } catch (error) {
    // Silent failure - NEVER do this
  }
}
```

### 3.2 Async/Await Patterns

```typescript
// ✅ CORRECT - Parallel operations when independent
async function getPostWithRelations(postId: string) {
  const [post, media, targets] = await Promise.all([
    prisma.post.findUnique({ where: { id: postId } }),
    prisma.postMedia.findMany({ where: { postId } }),
    prisma.postTarget.findMany({ where: { postId } }),
  ]);
  
  return { post, media, targets };
}

// ✅ CORRECT - Sequential when dependent
async function publishPost(postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new AppError('Post not found', 404);
  
  const validatedPost = await validateForPublishing(post);
  const result = await platformService.publish(validatedPost);
  
  return result;
}

// ❌ WRONG - Sequential when could be parallel
async function inefficientExample() {
  const users = await prisma.user.findMany();
  const posts = await prisma.post.findMany(); // These are independent!
  const media = await prisma.media.findMany(); // Could run in parallel
}
```

### 3.3 Service Layer Pattern

```typescript
// ✅ CORRECT - Services encapsulate business logic
// src/services/post.service.ts

import { prisma } from '@/config/database';
import { QuotaService } from './quota.service';
import { CreatePostInput, UpdatePostInput } from '@/schemas/post.schema';

export class PostService {
  private readonly quotaService: QuotaService;
  
  constructor() {
    this.quotaService = new QuotaService();
  }
  
  async create(userId: string, input: CreatePostInput): Promise<Post> {
    // Business logic here
    await this.validatePlatformAccess(userId, input.platforms);
    await this.validateQuota(userId, input.platforms);
    
    const post = await prisma.post.create({
      data: {
        userId,
        content: input.content,
        status: input.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: input.scheduledAt,
        targets: {
          create: input.platforms.map((platform) => ({
            accountId: this.getAccountId(userId, platform),
          })),
        },
      },
    });
    
    if (input.scheduledAt) {
      await this.schedulePublication(post);
    }
    
    return post;
  }
  
  private async validateQuota(userId: string, platforms: Platform[]): Promise<void> {
    for (const platform of platforms) {
      const canPost = await this.quotaService.canPerformAction(userId, platform);
      if (!canPost.allowed) {
        throw new AppError(canPost.reason!, 429, 'QUOTA_EXCEEDED');
      }
    }
  }
}
```

### 3.4 Controller Pattern

```typescript
// ✅ CORRECT - Controllers are thin, delegate to services
// src/controllers/post.controller.ts

import { Request, Response, NextFunction } from 'express';
import { PostService } from '@/services/post.service';

const postService = new PostService();

export const postController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const post = await postService.create(req.user!.id, req.body);
      res.status(201).json(post);
    } catch (error) {
      next(error);
    }
  },
  
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const posts = await postService.list(req.user!.id, req.query);
      res.json(posts);
    } catch (error) {
      next(error);
    }
  },
};
```

---

## 4. Security Coding Standards

### 4.1 Input Validation

```typescript
// ✅ ALWAYS validate input with Zod schemas
import { z } from 'zod';

export const createPostSchema = z.object({
  content: z.string()
    .min(1, 'Content is required')
    .max(10000, 'Content too long'),
  platforms: z.array(
    z.enum(['TWITTER', 'LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'YOUTUBE', 'PINTEREST'])
  ).min(1, 'Select at least one platform'),
  scheduledAt: z.string().datetime().optional(),
  mediaIds: z.array(z.string().cuid()).max(10).optional(),
});

// In routes
router.post('/', validate(createPostSchema), postController.create);
```

### 4.2 SQL Injection Prevention

```typescript
// ✅ CORRECT - Use Prisma's parameterized queries
const user = await prisma.user.findUnique({
  where: { email: userInput },
});

// ✅ CORRECT - If raw query needed, use $queryRaw with template
const result = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${userInput}
`;

// ❌ NEVER - String concatenation
const result = await prisma.$queryRawUnsafe(
  `SELECT * FROM users WHERE email = '${userInput}'`
);
```

### 4.3 Authentication Checks

```typescript
// ✅ CORRECT - Always verify ownership
async function updatePost(userId: string, postId: string, data: UpdatePostInput) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });
  
  if (!post) {
    throw new AppError('Post not found', 404);
  }
  
  // CRITICAL: Verify ownership
  if (post.userId !== userId) {
    throw new AppError('Access denied', 403);
  }
  
  return prisma.post.update({
    where: { id: postId },
    data,
  });
}

// ❌ WRONG - Missing ownership check
async function insecureUpdate(postId: string, data: UpdatePostInput) {
  // Anyone could update any post!
  return prisma.post.update({
    where: { id: postId },
    data,
  });
}
```

### 4.4 Sensitive Data Handling

```typescript
// ✅ CORRECT - Never log sensitive data
logger.info('User login attempt', { email: maskEmail(email) });

// ✅ CORRECT - Encrypt sensitive fields
const account = await prisma.socialAccount.create({
  data: {
    platform: 'TWITTER',
    accessToken: encryptToken(accessToken),  // Encrypted
    refreshToken: encryptToken(refreshToken), // Encrypted
    // ...
  },
});

// ✅ CORRECT - Exclude sensitive fields from responses
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    // password: false - excluded
    // mfaSecret: false - excluded
  },
});

// ❌ WRONG - Exposing sensitive data
const user = await prisma.user.findUnique({ where: { id } });
res.json(user); // Includes password hash!
```

---

## 5. Testing Standards

### 5.1 Test File Structure

```typescript
// src/services/__tests__/post.service.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PostService } from '../post.service';
import { prisma } from '@/config/database';

// Mock external dependencies
vi.mock('@/config/database');

describe('PostService', () => {
  let postService: PostService;
  
  beforeEach(() => {
    postService = new PostService();
    vi.clearAllMocks();
  });
  
  describe('create', () => {
    it('should create a post with valid input', async () => {
      // Arrange
      const userId = 'user-123';
      const input = {
        content: 'Test post',
        platforms: ['TWITTER'],
      };
      
      vi.mocked(prisma.post.create).mockResolvedValue({
        id: 'post-123',
        ...input,
        userId,
      });
      
      // Act
      const result = await postService.create(userId, input);
      
      // Assert
      expect(result.content).toBe('Test post');
      expect(prisma.post.create).toHaveBeenCalledTimes(1);
    });
    
    it('should throw when quota exceeded', async () => {
      // Arrange
      const userId = 'user-123';
      const input = {
        content: 'Test post',
        platforms: ['TWITTER'],
      };
      
      vi.spyOn(postService['quotaService'], 'canPerformAction')
        .mockResolvedValue({ allowed: false, reason: 'Quota exceeded' });
      
      // Act & Assert
      await expect(postService.create(userId, input))
        .rejects
        .toThrow('Quota exceeded');
    });
  });
});
```

### 5.2 Test Coverage Requirements

| Area | Minimum Coverage |
|------|------------------|
| Services | 80% |
| Controllers | 70% |
| Middleware | 90% |
| Utils | 90% |
| Overall | 75% |

---

## 6. Logging Standards

### 6.1 Logger Configuration

```typescript
// src/utils/logger.ts

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  redact: {
    paths: ['password', 'accessToken', 'refreshToken', 'mfaSecret', '*.password'],
    censor: '[REDACTED]',
  },
});
```

### 6.2 Logging Best Practices

```typescript
// ✅ CORRECT - Structured logging with context
logger.info('Post published successfully', {
  postId: post.id,
  platforms: post.targets.map(t => t.platform),
  userId: post.userId,
});

// ✅ CORRECT - Error logging with stack trace
logger.error('Failed to publish post', {
  error: error.message,
  stack: error.stack,
  postId,
  platform,
});

// ✅ CORRECT - Use appropriate log levels
logger.debug('Cache hit', { key }); // Development debugging
logger.info('User logged in', { userId }); // Normal operations
logger.warn('Rate limit approaching', { current, limit }); // Warnings
logger.error('Database connection failed', { error }); // Errors

// ❌ WRONG - Don't use console
console.log('User logged in'); // Use logger.info instead

// ❌ WRONG - Don't log sensitive data
logger.info('Login attempt', { email, password }); // Password!
```

---

## 7. Git Workflow

### 7.1 Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<ticket>-<description>` | `feature/AP-123-add-mfa` |
| Bug fix | `fix/<ticket>-<description>` | `fix/AP-456-quota-calculation` |
| Hotfix | `hotfix/<description>` | `hotfix/security-patch` |
| Release | `release/<version>` | `release/1.0.0` |

### 7.2 Commit Messages

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

**Examples:**
```
feat(auth): add TOTP-based MFA support

- Implement MFA setup flow with QR code generation
- Add backup codes generation and validation
- Create MFA verification middleware

Closes #123
```

```
fix(quota): correct Twitter monthly reset calculation

The quota was resetting daily instead of monthly for Twitter.
Updated period calculation to use month boundaries.

Fixes #456
```

### 7.3 Pull Request Checklist

Before submitting PR:
- [ ] All tests pass locally
- [ ] No ESLint errors or warnings
- [ ] New code has tests
- [ ] Security considerations reviewed
- [ ] Documentation updated if needed
- [ ] No sensitive data in code or logs
- [ ] Database migrations tested
- [ ] Environment variables documented

---

## 8. Documentation Requirements

### 8.1 Code Comments

```typescript
// ✅ CORRECT - Explain WHY, not WHAT
// Use exponential backoff to avoid overwhelming the API
// during temporary outages
const delay = Math.pow(2, attempt) * 1000;

// ✅ CORRECT - Document complex algorithms
/**
 * Calculates the quota reset time based on platform-specific rules.
 * 
 * Twitter: First of each month at midnight UTC
 * YouTube: Midnight PST daily
 * Instagram: Rolling 24-hour window from first post
 * 
 * @param platform - The social media platform
 * @returns Date when quota resets
 */
function getQuotaResetTime(platform: Platform): Date {
  // ...
}

// ❌ WRONG - Obvious comments add noise
// Increment counter
counter++;

// Loop through users
for (const user of users) {
```

### 8.2 JSDoc for Public APIs

```typescript
/**
 * Creates a new social media post and schedules it for publishing.
 * 
 * @param userId - The ID of the user creating the post
 * @param input - The post creation input data
 * @param input.content - The text content of the post
 * @param input.platforms - Array of platforms to publish to
 * @param input.scheduledAt - Optional ISO date string for scheduling
 * @returns The created post with associated targets
 * @throws {ValidationError} If input validation fails
 * @throws {AppError} If quota exceeded for any platform
 * 
 * @example
 * ```typescript
 * const post = await postService.create('user-123', {
 *   content: 'Hello world!',
 *   platforms: ['TWITTER', 'LINKEDIN'],
 *   scheduledAt: '2026-01-15T10:00:00Z',
 * });
 * ```
 */
async create(userId: string, input: CreatePostInput): Promise<Post> {
  // ...
}
```

---

## 9. Environment Setup

### 9.1 Required Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20.x LTS | Runtime |
| pnpm | 8.x+ | Package manager |
| Docker | 24.x+ | Containerization |
| PostgreSQL | 16.x | Database |
| Redis | 7.x | Queue/Cache |

### 9.2 Local Development

```bash
# Clone repository
git clone https://github.com/your-org/auto-postit.git
cd auto-postit

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env
# Edit .env with your values

# Start databases
docker compose up -d postgres redis

# Run migrations
pnpm prisma migrate dev

# Start development servers
pnpm dev
```

---

*Last Updated: January 12, 2026*
