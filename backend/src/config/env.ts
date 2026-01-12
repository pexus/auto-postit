import { z } from 'zod';

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Redis
  REDIS_URL: z.string().url(),
  
  // Session & Security
  SESSION_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z.string().length(64), // 32 bytes hex-encoded
  CSRF_SECRET: z.string().min(32),
  
  // CORS
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  
  // MFA
  MFA_ISSUER: z.string().default('Auto-PostIt'),
  
  // OAuth - Twitter/X
  TWITTER_CLIENT_ID: z.string().optional(),
  TWITTER_CLIENT_SECRET: z.string().optional(),
  TWITTER_CALLBACK_URL: z.string().url().optional(),
  
  // OAuth - LinkedIn
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_CALLBACK_URL: z.string().url().optional(),
  
  // OAuth - Facebook
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  FACEBOOK_CALLBACK_URL: z.string().url().optional(),
  
  // OAuth - Instagram (uses Facebook)
  INSTAGRAM_CALLBACK_URL: z.string().url().optional(),
  
  // OAuth - YouTube (Google)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  
  // OAuth - Pinterest
  PINTEREST_APP_ID: z.string().optional(),
  PINTEREST_APP_SECRET: z.string().optional(),
  PINTEREST_CALLBACK_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
