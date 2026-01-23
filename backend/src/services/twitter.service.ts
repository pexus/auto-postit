import crypto from 'crypto';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/errorHandler.js';

// Twitter OAuth 2.0 endpoints
const TWITTER_AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
const TWITTER_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const TWITTER_USER_URL = 'https://api.twitter.com/2/users/me';
const TWITTER_TWEET_URL = 'https://api.twitter.com/2/tweets';
// Twitter v2 media upload endpoint (supports OAuth 2.0!)
const TWITTER_MEDIA_UPLOAD_URL = 'https://api.x.com/2/media/upload';

// Scopes needed for posting
const TWITTER_SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'offline.access', // For refresh tokens
];

interface TwitterTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface TwitterUser {
  id: string;
  name: string;
  username: string;
}

interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}

// Store PKCE challenges temporarily (in production, use Redis)
const pkceStore = new Map<string, { codeVerifier: string; userId: string; expiresAt: number }>();

class TwitterService {
  /**
   * Check if Twitter is configured for OAuth 2.0 (user auth)
   */
  isConfigured(): boolean {
    return !!(env.TWITTER_CLIENT_ID && env.TWITTER_CLIENT_SECRET && env.TWITTER_CALLBACK_URL);
  }

  /**
   * Generate PKCE challenge for OAuth 2.0
   */
  private generatePKCE(): PKCEChallenge {
    // Generate code verifier (43-128 chars, URL-safe)
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    
    // Generate code challenge (SHA256 hash of verifier, base64url encoded)
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    // Generate state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');
    
    return { codeVerifier, codeChallenge, state };
  }

  /**
   * Generate Twitter authorization URL
   */
  generateAuthUrl(userId: string): string {
    if (!this.isConfigured()) {
      throw new AppError('Twitter is not configured', 503, true, 'TWITTER_NOT_CONFIGURED');
    }

    const pkce = this.generatePKCE();
    
    // Store PKCE verifier with state (expires in 10 minutes)
    pkceStore.set(pkce.state, {
      codeVerifier: pkce.codeVerifier,
      userId,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // Clean up expired entries
    for (const [key, value] of pkceStore.entries()) {
      if (value.expiresAt < Date.now()) {
        pkceStore.delete(key);
      }
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.TWITTER_CLIENT_ID!,
      redirect_uri: env.TWITTER_CALLBACK_URL!,
      scope: TWITTER_SCOPES.join(' '),
      state: pkce.state,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${TWITTER_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, state: string): Promise<{ userId: string; tokens: TwitterTokens }> {
    if (!this.isConfigured()) {
      throw new AppError('Twitter is not configured', 503, true, 'TWITTER_NOT_CONFIGURED');
    }

    // Get PKCE verifier from store
    const pkceData = pkceStore.get(state);
    if (!pkceData) {
      throw new AppError('Invalid or expired state parameter', 400, true, 'INVALID_STATE');
    }

    if (pkceData.expiresAt < Date.now()) {
      pkceStore.delete(state);
      throw new AppError('Authorization session expired', 400, true, 'SESSION_EXPIRED');
    }

    // Remove from store (one-time use)
    pkceStore.delete(state);

    // Exchange code for tokens
    const credentials = Buffer.from(`${env.TWITTER_CLIENT_ID}:${env.TWITTER_CLIENT_SECRET}`).toString('base64');
    
    const tokenResponse = await fetch(TWITTER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: env.TWITTER_CALLBACK_URL!,
        code_verifier: pkceData.codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      logger.error({ error, status: tokenResponse.status }, 'Twitter token exchange failed');
      throw new AppError('Failed to exchange code for tokens', 400, true, 'TOKEN_EXCHANGE_FAILED');
    }

    const tokens = await tokenResponse.json() as TwitterTokens;
    
    return { userId: pkceData.userId, tokens };
  }

  /**
   * Get Twitter user info
   */
  async getUserInfo(accessToken: string): Promise<TwitterUser> {
    const response = await fetch(TWITTER_USER_URL, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, status: response.status }, 'Failed to get Twitter user info');
      throw new AppError('Failed to get Twitter user info', 400, true, 'USER_INFO_FAILED');
    }

    const data = await response.json() as { data: TwitterUser };
    return data.data;
  }

  /**
   * Save Twitter platform connection
   */
  async savePlatformConnection(
    userId: string,
    tokens: TwitterTokens,
    twitterUser: TwitterUser
  ): Promise<void> {
    // Check if already connected
    const existing = await prisma.platform.findFirst({
      where: {
        userId,
        type: 'TWITTER',
        platformUserId: twitterUser.id,
      },
    });

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    if (existing) {
      // Update existing connection
      await prisma.platform.update({
        where: { id: existing.id },
        data: {
          accessToken: encrypt(tokens.access_token),
          refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
          tokenExpiresAt,
          platformUsername: `@${twitterUser.username}`,
          name: twitterUser.name,
          isActive: true,
          lastSyncAt: new Date(),
        },
      });
      logger.info({ platformId: existing.id, userId }, 'Twitter platform updated');
    } else {
      // Create new connection
      await prisma.platform.create({
        data: {
          userId,
          type: 'TWITTER',
          platformUserId: twitterUser.id,
          platformUsername: `@${twitterUser.username}`,
          name: twitterUser.name,
          accessToken: encrypt(tokens.access_token),
          refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
          tokenExpiresAt,
          isActive: true,
          lastSyncAt: new Date(),
        },
      });
      logger.info({ userId, twitterUsername: twitterUser.username }, 'Twitter platform connected');
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(platformId: string): Promise<string> {
    const platform = await prisma.platform.findUnique({
      where: { id: platformId },
    });

    if (!platform || !platform.refreshToken) {
      throw new AppError('Platform not found or no refresh token', 400, true, 'NO_REFRESH_TOKEN');
    }

    const refreshToken = decrypt(platform.refreshToken);
    const credentials = Buffer.from(`${env.TWITTER_CLIENT_ID}:${env.TWITTER_CLIENT_SECRET}`).toString('base64');

    const response = await fetch(TWITTER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, platformId }, 'Twitter token refresh failed');
      
      // Mark platform as inactive if refresh fails
      await prisma.platform.update({
        where: { id: platformId },
        data: { isActive: false },
      });
      
      throw new AppError('Failed to refresh token. Please reconnect Twitter.', 401, true, 'TOKEN_REFRESH_FAILED');
    }

    const tokens = await response.json() as TwitterTokens;
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Update stored tokens
    await prisma.platform.update({
      where: { id: platformId },
      data: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : platform.refreshToken,
        tokenExpiresAt,
        lastSyncAt: new Date(),
      },
    });

    logger.info({ platformId }, 'Twitter token refreshed');
    return tokens.access_token;
  }

  /**
   * Get valid access token (refresh if needed)
   */
  async getValidAccessToken(platformId: string): Promise<string> {
    const platform = await prisma.platform.findUnique({
      where: { id: platformId },
    });

    if (!platform) {
      throw new AppError('Platform not found', 404, true, 'PLATFORM_NOT_FOUND');
    }

    // Check if token is expired or will expire in next 5 minutes
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes
    const isExpired = platform.tokenExpiresAt && platform.tokenExpiresAt.getTime() < Date.now() + expiryBuffer;

    if (isExpired && platform.refreshToken) {
      return this.refreshAccessToken(platformId);
    }

    return decrypt(platform.accessToken);
  }

  /**
   * Post a tweet
   */
  async postTweet(platformId: string, content: string, mediaIds?: string[]): Promise<{ tweetId: string; tweetUrl: string }> {
    const accessToken = await this.getValidAccessToken(platformId);

    const tweetData: { text: string; media?: { media_ids: string[] } } = {
      text: content,
    };

    if (mediaIds && mediaIds.length > 0) {
      tweetData.media = { media_ids: mediaIds };
    }

    const response = await fetch(TWITTER_TWEET_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetData),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, platformId, status: response.status }, 'Failed to post tweet');
      throw new AppError(`Failed to post tweet: ${error}`, 400, true, 'TWEET_FAILED');
    }

    const result = await response.json() as { data: { id: string } };
    const tweetId = result.data.id;

    // Get platform username for URL
    const platform = await prisma.platform.findUnique({ where: { id: platformId } });
    const username = platform?.platformUsername?.replace('@', '') || 'user';
    const tweetUrl = `https://twitter.com/${username}/status/${tweetId}`;

    logger.info({ platformId, tweetId }, 'Tweet posted successfully');
    
    return { tweetId, tweetUrl };
  }

  /**
   * Upload media to Twitter using the v2 API
   * The v2 media upload endpoint supports OAuth 2.0!
   * Returns the Twitter media_id to attach to tweets
   */
  async uploadMedia(platformId: string, mediaBuffer: Buffer, mimeType: string): Promise<string> {
    // Get user's OAuth 2.0 token
    const accessToken = await this.getValidAccessToken(platformId);
    
    // Determine media category based on mime type
    // v2 API supports: tweet_image, dm_image, subtitles
    let mediaCategory: string;
    if (mimeType.startsWith('image/')) {
      mediaCategory = 'tweet_image';
    } else {
      throw new AppError(`Unsupported media type for v2 upload: ${mimeType}. Currently only images are supported.`, 400, true, 'UNSUPPORTED_MEDIA_TYPE');
    }

    // Map common mime types to the expected format
    let mediaType = mimeType;
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/pjpeg', 'image/tiff'];
    if (!supportedTypes.includes(mimeType)) {
      // Default to jpeg for unsupported types
      if (mimeType.startsWith('image/')) {
        mediaType = 'image/jpeg';
      }
    }

    // Convert buffer to base64 for upload
    const mediaBase64 = mediaBuffer.toString('base64');

    logger.info({ 
      mediaSize: mediaBuffer.length,
      mimeType,
      mediaType,
      mediaCategory 
    }, 'Starting Twitter v2 media upload');

    const response = await fetch(TWITTER_MEDIA_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media: mediaBase64,
        media_category: mediaCategory,
        media_type: mediaType,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, status: response.status }, 'Twitter v2 media upload failed');
      throw new AppError(`Failed to upload media to Twitter: ${error}`, 400, true, 'MEDIA_UPLOAD_FAILED');
    }

    const result = await response.json() as { data: { id: string; media_key?: string } };
    const mediaId = result.data.id;
    
    logger.info({ mediaId, mediaKey: result.data.media_key }, 'Media uploaded successfully via Twitter v2 API');
    return mediaId;
  }
}

export const twitterService = new TwitterService();
