import { z } from 'zod';

// Helper for optional URL that treats empty string as undefined
const optionalUrl = z.string().transform(val => val === '' ? undefined : val).pipe(z.string().url().optional());
const optionalString = z.string().transform(val => val === '' ? undefined : val).pipe(z.string().optional());

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
  TWITTER_CLIENT_ID: optionalString,
  TWITTER_CLIENT_SECRET: optionalString,
  TWITTER_CALLBACK_URL: optionalUrl,
  
  // OAuth - LinkedIn
  LINKEDIN_CLIENT_ID: optionalString,
  LINKEDIN_CLIENT_SECRET: optionalString,
  LINKEDIN_CALLBACK_URL: optionalUrl,
  
  // OAuth - Facebook
  FACEBOOK_APP_ID: optionalString,
  FACEBOOK_APP_SECRET: optionalString,
  FACEBOOK_CALLBACK_URL: optionalUrl,
  
  // OAuth - Instagram (uses Facebook)
  INSTAGRAM_CALLBACK_URL: optionalUrl,
  
  // OAuth - YouTube (Google)
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_CALLBACK_URL: optionalUrl,
  
  // OAuth - Pinterest
  PINTEREST_APP_ID: optionalString,
  PINTEREST_APP_SECRET: optionalString,
  PINTEREST_CALLBACK_URL: optionalUrl,
  
  // Media Storage
  MEDIA_PATH: z.string().default('./media'),
  MEDIA_UPLOADS_PATH: z.string().default('./uploads'),
  MEDIA_MAX_IMAGE_SIZE: z.string().default('10485760').transform(Number), // 10 MB
  MEDIA_MAX_VIDEO_SIZE: z.string().default('524288000').transform(Number), // 500 MB
  MEDIA_BASE_URL: optionalString, // Optional CDN URL
  
  // OpenAI
  OPENAI_API_KEY: optionalString,
  OPENAI_DEFAULT_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_AVAILABLE_MODELS: z.string().default('gpt-4o,gpt-4o-mini,gpt-3.5-turbo'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
