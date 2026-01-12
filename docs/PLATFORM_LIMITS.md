# Platform API Limits & Quota Tracking
## Auto-PostIt - Social Media Platform Constraints

> **CRITICAL**: This document defines the API limits for each platform.
> All platform service implementations MUST respect these limits and track usage.

---

## 1. Platform Limits Summary

| Platform | Free Tier Limit | Reset Period | Quota Unit | Cost Per Post |
|----------|-----------------|--------------|------------|---------------|
| X (Twitter) | 100 posts | Monthly | Posts | 1 |
| LinkedIn | 100 requests | Daily | API calls | ~3 calls |
| Facebook | 200 posts | Hourly | Posts | 1 |
| Instagram | 100 posts | 24 hours | Posts | 1 |
| YouTube | 10,000 units | Daily | Quota units | 1600 |
| Pinterest | 1000 requests | Hourly | API calls | 1 |

---

## 2. Detailed Platform Specifications

### 2.1 X (Twitter) API

```typescript
export const TWITTER_LIMITS = {
  // Posting limits
  posts: {
    free: {
      limit: 100,
      period: 'month',
      resetDay: 1, // First of month
    },
    basic: {
      limit: 15000,
      period: 'month',
      cost: 200, // USD/month
    },
  },
  
  // Content limits
  content: {
    textLength: 280,
    images: {
      maxCount: 4,
      maxSizeBytes: 5 * 1024 * 1024, // 5 MB
      formats: ['JPEG', 'PNG', 'GIF', 'WEBP'],
    },
    videos: {
      maxCount: 1,
      maxSizeBytes: 512 * 1024 * 1024, // 512 MB
      maxDurationSeconds: 140, // 2:20
      formats: ['MP4'],
    },
    gifs: {
      maxSizeBytes: 15 * 1024 * 1024, // 15 MB
    },
  },
  
  // Rate limits (requests per 15 min window)
  rateLimit: {
    postTweet: 200,
    uploadMedia: 415,
    getUserTimeline: 900,
  },
  
  // API endpoints
  endpoints: {
    postTweet: 'POST /2/tweets',
    uploadMedia: 'POST /1.1/media/upload.json',
    deleteTweet: 'DELETE /2/tweets/:id',
  },
};
```

### 2.2 LinkedIn API

```typescript
export const LINKEDIN_LIMITS = {
  // Rate limits
  rateLimit: {
    daily: {
      limit: 100000, // Application level
      period: 'day',
    },
    perMember: {
      limit: 100,
      period: 'day',
    },
  },
  
  // Content limits
  content: {
    textLength: 3000,
    images: {
      maxCount: 20,
      maxSizeBytes: 8 * 1024 * 1024, // 8 MB
      formats: ['JPEG', 'PNG', 'GIF'],
    },
    videos: {
      maxSizeBytes: 5 * 1024 * 1024 * 1024, // 5 GB
      maxDurationSeconds: 600, // 10 min
      formats: ['MP4', 'MOV'],
    },
    documents: {
      maxSizeBytes: 100 * 1024 * 1024, // 100 MB
      formats: ['PDF', 'PPT', 'PPTX', 'DOC', 'DOCX'],
    },
  },
  
  // API costs (approximate calls per post)
  apiCosts: {
    textPost: 1,
    imagePost: 3, // upload + create + publish
    videoPost: 4, // register + upload + create + publish
    documentPost: 4,
  },
  
  // Endpoints
  endpoints: {
    createPost: 'POST /rest/posts',
    uploadImage: 'POST /rest/images',
    uploadVideo: 'POST /rest/videos',
    getUserProfile: 'GET /rest/me',
  },
};
```

### 2.3 Facebook Pages API

```typescript
export const FACEBOOK_LIMITS = {
  // Publishing limits
  publishing: {
    postsPerHour: 200, // Per page
    postsPerDay: 1000, // Practical limit
  },
  
  // Rate limits
  rateLimit: {
    callsPerHour: 4800, // App + User token combined
    callsPerDay: 86400,
  },
  
  // Content limits
  content: {
    textLength: 63206,
    images: {
      maxSizeBytes: 4 * 1024 * 1024, // 4 MB
      formats: ['JPEG', 'PNG', 'GIF', 'BMP', 'TIFF'],
    },
    videos: {
      maxSizeBytes: 10 * 1024 * 1024 * 1024, // 10 GB
      maxDurationSeconds: 14400, // 4 hours
      formats: ['MP4', 'MOV', 'AVI', 'WMV'],
    },
  },
  
  // API costs
  apiCosts: {
    textPost: 1,
    photoPost: 2,
    videoPost: 3,
  },
  
  // Endpoints
  endpoints: {
    createPost: 'POST /{page-id}/feed',
    uploadPhoto: 'POST /{page-id}/photos',
    uploadVideo: 'POST /{page-id}/videos',
  },
};
```

### 2.4 Instagram API

```typescript
export const INSTAGRAM_LIMITS = {
  // Publishing limits (CRITICAL - strictly enforced)
  publishing: {
    postsPerDay: 100, // 24-hour rolling window
    apiPublishedOnly: true, // Only counts API posts, not manual
  },
  
  // Content limits
  content: {
    captionLength: 2200,
    hashtags: 30, // Max hashtags per post
    images: {
      maxCount: 10, // Carousel
      formats: ['JPEG'], // ONLY JPEG supported!
      aspectRatio: {
        min: 0.8, // 4:5
        max: 1.91, // 1.91:1
      },
    },
    videos: {
      feed: {
        maxDurationSeconds: 60,
        maxSizeBytes: 100 * 1024 * 1024,
      },
      reels: {
        maxDurationSeconds: 90,
        maxSizeBytes: 1 * 1024 * 1024 * 1024,
      },
      stories: {
        maxDurationSeconds: 60,
        maxSizeBytes: 100 * 1024 * 1024,
      },
    },
  },
  
  // Requirements
  requirements: {
    accountType: 'PROFESSIONAL', // Business or Creator
    facebookPageRequired: true,
    mediaHosting: 'PUBLIC_URL', // Media must be accessible via URL
  },
  
  // API flow
  apiFlow: {
    // Step 1: Create container
    createContainer: 'POST /{ig-user-id}/media',
    // Step 2: Wait for processing (poll status)
    checkStatus: 'GET /{container-id}?fields=status_code',
    // Step 3: Publish
    publish: 'POST /{ig-user-id}/media_publish',
    // Check quota
    checkQuota: 'GET /{ig-user-id}/content_publishing_limit',
  },
};
```

### 2.5 YouTube API

```typescript
export const YOUTUBE_LIMITS = {
  // Quota system
  quota: {
    dailyLimit: 10000, // Units per day
    resetTime: '00:00 PST', // Pacific time
    costs: {
      upload: 1600, // Video upload
      update: 50,   // Update video metadata
      delete: 50,   // Delete video
      read: 1,      // Most read operations
      search: 100,  // Search operation
      playlist: 50, // Playlist operations
    },
  },
  
  // Practical limits with default quota
  practicalLimits: {
    uploadsPerDay: 6, // 10000 / 1600 = ~6
  },
  
  // Content limits
  content: {
    titleLength: 100,
    descriptionLength: 5000,
    tagsLength: 500, // Total characters
    videos: {
      maxSizeBytes: 256 * 1024 * 1024 * 1024, // 256 GB
      maxDurationSeconds: 43200, // 12 hours
      formats: ['MP4', 'MOV', 'AVI', 'WMV', 'FLV', 'MPEG', 'WebM'],
    },
    thumbnails: {
      maxSizeBytes: 2 * 1024 * 1024, // 2 MB
      formats: ['JPEG', 'PNG', 'GIF', 'BMP'],
      dimensions: {
        width: 1280,
        height: 720,
      },
    },
  },
  
  // Endpoints
  endpoints: {
    upload: 'POST /upload/youtube/v3/videos',
    update: 'PUT /youtube/v3/videos',
    delete: 'DELETE /youtube/v3/videos',
    getThumbnail: 'POST /youtube/v3/thumbnails/set',
  },
};
```

### 2.6 Pinterest API

```typescript
export const PINTEREST_LIMITS = {
  // Rate limits
  rateLimit: {
    standard: {
      limit: 1000,
      period: 'hour',
    },
    write: {
      limit: 300,
      period: 'hour',
    },
  },
  
  // Content limits
  content: {
    titleLength: 100,
    descriptionLength: 500,
    linkLength: 2048,
    images: {
      maxSizeBytes: 32 * 1024 * 1024, // 32 MB
      minDimension: 100,
      formats: ['JPEG', 'PNG', 'GIF', 'WEBP'],
    },
    videos: {
      maxSizeBytes: 2 * 1024 * 1024 * 1024, // 2 GB
      maxDurationSeconds: 900, // 15 min
      minDurationSeconds: 4,
      formats: ['MP4', 'MOV', 'M4V'],
    },
  },
  
  // Requirements
  requirements: {
    accountType: 'BUSINESS',
    appApproval: true,
  },
  
  // Endpoints
  endpoints: {
    createPin: 'POST /v5/pins',
    getBoards: 'GET /v5/boards',
    uploadMedia: 'POST /v5/media',
  },
};
```

---

## 3. Quota Tracking Implementation

### 3.1 Database Schema

```prisma
model QuotaUsage {
  id          String   @id @default(cuid())
  platform    Platform
  action      String   // POST, UPLOAD, READ, DELETE
  cost        Int      // Quota units consumed
  periodStart DateTime // Start of quota period
  periodEnd   DateTime // End of quota period (reset time)
  createdAt   DateTime @default(now())
  
  accountId   String
  account     SocialAccount @relation(fields: [accountId], references: [id])
  
  @@index([accountId, platform, periodStart])
}

model QuotaConfig {
  id            String   @id @default(cuid())
  platform      Platform @unique
  periodType    String   // HOURLY, DAILY, MONTHLY
  limit         Int
  warningThreshold Int   @default(80) // Percentage
  
  updatedAt     DateTime @updatedAt
}
```

### 3.2 Quota Service

```typescript
// services/quota.service.ts

import { Platform } from '@prisma/client';

interface QuotaStatus {
  platform: Platform;
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  resetsAt: Date;
  canPost: boolean;
  warning: boolean;
}

export class QuotaService {
  private readonly WARNING_THRESHOLD = 80; // 80%
  private readonly BLOCK_THRESHOLD = 95;   // 95% - stop posting

  async getQuotaStatus(accountId: string, platform: Platform): Promise<QuotaStatus> {
    const config = await this.getQuotaConfig(platform);
    const { periodStart, periodEnd } = this.getCurrentPeriod(platform);
    
    const usage = await prisma.quotaUsage.aggregate({
      where: {
        accountId,
        platform,
        createdAt: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
      _sum: { cost: true },
    });
    
    const used = usage._sum.cost || 0;
    const remaining = config.limit - used;
    const percentUsed = (used / config.limit) * 100;
    
    return {
      platform,
      used,
      limit: config.limit,
      remaining,
      percentUsed,
      resetsAt: periodEnd,
      canPost: percentUsed < this.BLOCK_THRESHOLD,
      warning: percentUsed >= this.WARNING_THRESHOLD,
    };
  }

  async recordUsage(
    accountId: string,
    platform: Platform,
    action: string,
    cost: number
  ): Promise<void> {
    const { periodStart, periodEnd } = this.getCurrentPeriod(platform);
    
    await prisma.quotaUsage.create({
      data: {
        accountId,
        platform,
        action,
        cost,
        periodStart,
        periodEnd,
      },
    });
  }

  async canPerformAction(
    accountId: string,
    platform: Platform,
    cost: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const status = await this.getQuotaStatus(accountId, platform);
    
    if (status.remaining < cost) {
      return {
        allowed: false,
        reason: `Insufficient quota. Need ${cost}, have ${status.remaining}. Resets at ${status.resetsAt}`,
      };
    }
    
    if (!status.canPost) {
      return {
        allowed: false,
        reason: `Quota nearly exhausted (${status.percentUsed.toFixed(1)}%). Blocked to prevent lockout.`,
      };
    }
    
    return { allowed: true };
  }

  private getCurrentPeriod(platform: Platform): { periodStart: Date; periodEnd: Date } {
    const now = new Date();
    const config = PLATFORM_CONFIGS[platform];
    
    switch (config.periodType) {
      case 'HOURLY':
        return {
          periodStart: new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()),
          periodEnd: new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1),
        };
      case 'DAILY':
        return {
          periodStart: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          periodEnd: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        };
      case 'MONTHLY':
        return {
          periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
          periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        };
      default:
        throw new Error(`Unknown period type: ${config.periodType}`);
    }
  }
}
```

### 3.3 Pre-Post Validation

```typescript
// middleware/quota.middleware.ts

export async function validateQuotaBeforePost(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { platforms } = req.body;
  const quotaService = new QuotaService();
  const user = req.user!;
  
  const quotaChecks = await Promise.all(
    platforms.map(async (platform: Platform) => {
      const account = await prisma.socialAccount.findFirst({
        where: { userId: user.id, platform, isActive: true },
      });
      
      if (!account) {
        return { platform, allowed: false, reason: 'Account not connected' };
      }
      
      const cost = getPostCost(platform, req.body);
      return {
        platform,
        ...(await quotaService.canPerformAction(account.id, platform, cost)),
      };
    })
  );
  
  const blocked = quotaChecks.filter(c => !c.allowed);
  
  if (blocked.length > 0) {
    return res.status(429).json({
      error: 'Quota limit exceeded',
      details: blocked,
    });
  }
  
  next();
}

function getPostCost(platform: Platform, postData: any): number {
  const hasMedia = postData.mediaIds?.length > 0;
  const hasVideo = postData.mediaIds?.some(isVideoMedia);
  
  switch (platform) {
    case 'TWITTER':
      return 1;
    case 'LINKEDIN':
      return hasVideo ? 4 : hasMedia ? 3 : 1;
    case 'FACEBOOK':
      return hasVideo ? 3 : hasMedia ? 2 : 1;
    case 'INSTAGRAM':
      return 1; // Instagram counts posts, not API calls
    case 'YOUTUBE':
      return 1600; // Video upload cost
    case 'PINTEREST':
      return 1;
    default:
      return 1;
  }
}
```

---

## 4. Quota Dashboard API

```typescript
// routes/quota.routes.ts

router.get('/api/quota', authMiddleware, async (req, res) => {
  const user = req.user!;
  const quotaService = new QuotaService();
  
  const accounts = await prisma.socialAccount.findMany({
    where: { userId: user.id, isActive: true },
  });
  
  const quotaStatus = await Promise.all(
    accounts.map(async (account) => ({
      platform: account.platform,
      status: await quotaService.getQuotaStatus(account.id, account.platform),
    }))
  );
  
  res.json({
    quotas: quotaStatus,
    summary: {
      totalPlatforms: quotaStatus.length,
      warnings: quotaStatus.filter(q => q.status.warning).length,
      blocked: quotaStatus.filter(q => !q.status.canPost).length,
    },
  });
});

router.get('/api/quota/history', authMiddleware, async (req, res) => {
  const { platform, days = 30 } = req.query;
  const user = req.user!;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - Number(days));
  
  const usage = await prisma.quotaUsage.findMany({
    where: {
      account: { userId: user.id },
      platform: platform as Platform | undefined,
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: 'desc' },
    include: { account: { select: { platform: true } } },
  });
  
  res.json({ usage });
});
```

---

## 5. API Call Optimization

### 5.1 Caching Strategy

```typescript
// Avoid unnecessary API calls with intelligent caching

const CACHE_TTL = {
  userProfile: 3600,      // 1 hour - rarely changes
  accountStatus: 300,     // 5 min - connection status
  quotaStatus: 60,        // 1 min - quota checks
  mediaUpload: 0,         // Never cache - always fresh
};

// Use Redis for caching
async function getCachedOrFetch<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  
  const fresh = await fetcher();
  await redis.setex(key, ttl, JSON.stringify(fresh));
  return fresh;
}
```

### 5.2 Batch Operations

```typescript
// Combine multiple posts into single API calls where possible

// LinkedIn: Batch media uploads
async function uploadMultipleImages(images: Buffer[]): Promise<string[]> {
  // Upload in parallel but track each as separate quota cost
  const uploads = await Promise.all(
    images.map(img => uploadSingleImage(img))
  );
  return uploads.map(u => u.mediaUrn);
}

// Facebook: Use batch API for multiple operations
async function batchFacebookRequests(requests: BatchRequest[]): Promise<BatchResponse[]> {
  // Single HTTP call, but each sub-request counts toward quota
  return fb.batch(requests);
}
```

### 5.3 Token Refresh Optimization

```typescript
// Only refresh tokens when actually needed

async function getValidToken(accountId: string): Promise<string> {
  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
  });
  
  const token = decryptToken(account.accessToken);
  const expiresAt = account.expiresAt;
  
  // Refresh if expiring within 5 minutes
  if (expiresAt && expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const newTokens = await refreshToken(account.platform, account.refreshToken);
    await updateStoredTokens(accountId, newTokens);
    return newTokens.accessToken;
  }
  
  return token;
}
```

---

## 6. Error Handling for Rate Limits

```typescript
// Handle platform-specific rate limit errors

interface RateLimitError {
  platform: Platform;
  retryAfter: number; // seconds
  message: string;
}

function handlePlatformError(error: any, platform: Platform): RateLimitError | null {
  switch (platform) {
    case 'TWITTER':
      if (error.code === 429) {
        return {
          platform,
          retryAfter: parseInt(error.headers['x-rate-limit-reset']) - Math.floor(Date.now() / 1000),
          message: 'Twitter rate limit exceeded',
        };
      }
      break;
    case 'INSTAGRAM':
      if (error.code === 4 || error.code === 17) { // Rate limit codes
        return {
          platform,
          retryAfter: 3600, // Default 1 hour
          message: 'Instagram rate limit exceeded',
        };
      }
      break;
    // ... handle other platforms
  }
  return null;
}

// Exponential backoff for retries
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
      await sleep(delay);
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## 7. Monitoring & Alerts

```typescript
// Alert when quota thresholds are reached

export async function checkQuotaAlerts(): Promise<void> {
  const accounts = await prisma.socialAccount.findMany({
    where: { isActive: true },
  });
  
  for (const account of accounts) {
    const status = await quotaService.getQuotaStatus(account.id, account.platform);
    
    if (status.percentUsed >= 90) {
      await sendAlert({
        type: 'QUOTA_CRITICAL',
        platform: account.platform,
        message: `${account.platform} quota at ${status.percentUsed.toFixed(1)}%`,
        remainingUnits: status.remaining,
        resetsAt: status.resetsAt,
      });
    } else if (status.percentUsed >= 80) {
      await sendAlert({
        type: 'QUOTA_WARNING',
        platform: account.platform,
        message: `${account.platform} quota at ${status.percentUsed.toFixed(1)}%`,
        remainingUnits: status.remaining,
        resetsAt: status.resetsAt,
      });
    }
  }
}

// Run hourly via cron job
// 0 * * * * checkQuotaAlerts
```

---

*Last Updated: January 12, 2026*
