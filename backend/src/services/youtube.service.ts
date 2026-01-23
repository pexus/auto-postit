import crypto from 'crypto';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/errorHandler.js';

// Google/YouTube OAuth 2.0 endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// YouTube OAuth scopes
const YOUTUBE_SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.readonly',
];

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface GoogleUser {
  sub: string;
  name: string;
  email: string;
  picture?: string;
}

interface YouTubeChannel {
  id: string;
  title: string;
  customUrl?: string | undefined;
  thumbnails?: {
    default?: { url: string };
  } | undefined;
}

// Store state and code verifier temporarily for OAuth flow
const stateStore = new Map<string, { userId: string; codeVerifier: string; expiresAt: number }>();

class YouTubeService {
  /**
   * Check if YouTube is configured
   */
  isConfigured(): boolean {
    return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL);
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = crypto.randomBytes(32)
      .toString('base64url')
      .substring(0, 128);
    
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return { codeVerifier, codeChallenge };
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(userId: string): string {
    if (!this.isConfigured()) {
      throw new AppError('YouTube OAuth is not configured', 503, true, 'YOUTUBE_NOT_CONFIGURED');
    }

    const state = crypto.randomBytes(16).toString('hex');
    const { codeVerifier, codeChallenge } = this.generatePKCE();
    
    stateStore.set(state, {
      userId,
      codeVerifier,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    this.cleanupExpiredStates();

    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      redirect_uri: env.GOOGLE_CALLBACK_URL!,
      response_type: 'code',
      scope: YOUTUBE_SCOPES.join(' '),
      state,
      access_type: 'offline', // Required to get refresh token
      prompt: 'consent', // Force consent screen to get refresh token
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  private cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [key, value] of stateStore.entries()) {
      if (value.expiresAt < now) {
        stateStore.delete(key);
      }
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async handleCallback(code: string, state: string): Promise<void> {
    const stateData = stateStore.get(state);
    if (!stateData || stateData.expiresAt < Date.now()) {
      stateStore.delete(state);
      throw new AppError('Invalid or expired state', 400, true, 'INVALID_STATE');
    }

    const { userId, codeVerifier } = stateData;
    stateStore.delete(state);

    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: env.GOOGLE_CALLBACK_URL!,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      logger.error({ error }, 'Google token exchange failed');
      throw new AppError('Failed to exchange authorization code', 400, true, 'TOKEN_EXCHANGE_FAILED');
    }

    const tokens = await tokenResponse.json() as GoogleTokens;

    // Get user info
    const userResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      const error = await userResponse.text();
      logger.error({ error }, 'Failed to fetch Google user info');
      throw new AppError('Failed to fetch Google user info', 400, true, 'USER_INFO_FAILED');
    }

    const googleUser = await userResponse.json() as GoogleUser;

    // Get YouTube channel info
    interface YouTubeChannelResponse {
      items?: Array<{
        id: string;
        snippet: {
          title: string;
          customUrl?: string;
          thumbnails?: { default?: { url: string } };
        };
      }>;
    }
    
    const channelResponse = await fetch(
      `${YOUTUBE_API_URL}/channels?part=snippet&mine=true`,
      {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      }
    );

    let channel: YouTubeChannel | null = null;
    if (channelResponse.ok) {
      const channelData = await channelResponse.json() as YouTubeChannelResponse;
      const items = channelData.items;
      if (items && items.length > 0) {
        const item = items[0];
        if (item) {
          channel = {
            id: item.id,
            title: item.snippet.title,
            customUrl: item.snippet.customUrl,
            thumbnails: item.snippet.thumbnails,
          };
        }
      }
    }

    if (!channel) {
      throw new AppError('No YouTube channel found for this account', 400, true, 'NO_CHANNEL');
    }

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Check if platform already exists
    const existingPlatform = await prisma.platform.findFirst({
      where: {
        userId,
        type: 'YOUTUBE',
        platformUserId: channel.id,
      },
    });

    if (existingPlatform) {
      await prisma.platform.update({
        where: { id: existingPlatform.id },
        data: {
          accessToken: encrypt(tokens.access_token),
          refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : existingPlatform.refreshToken,
          tokenExpiresAt,
          isActive: true,
          lastSyncAt: new Date(),
        },
      });
      logger.info({ userId, platformId: existingPlatform.id }, 'YouTube reconnected');
    } else {
      await prisma.platform.create({
        data: {
          userId,
          type: 'YOUTUBE',
          name: channel.title,
          platformUserId: channel.id,
          platformUsername: channel.customUrl || channel.title,
          accessToken: encrypt(tokens.access_token),
          refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
          tokenExpiresAt,
          isActive: true,
          lastSyncAt: new Date(),
          metadata: {
            googleUserId: googleUser.sub,
            email: googleUser.email,
          },
        },
      });
      logger.info({ userId, channelTitle: channel.title }, 'YouTube connected');
    }
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

    const needsRefresh = platform.tokenExpiresAt && 
      platform.tokenExpiresAt < new Date(Date.now() + 5 * 60 * 1000);

    if (needsRefresh && platform.refreshToken) {
      return this.refreshAccessToken(platformId);
    }

    return decrypt(platform.accessToken);
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

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, platformId }, 'Google token refresh failed');
      
      await prisma.platform.update({
        where: { id: platformId },
        data: { isActive: false },
      });
      
      throw new AppError('Failed to refresh token. Please reconnect YouTube.', 401, true, 'TOKEN_REFRESH_FAILED');
    }

    const tokens = await response.json() as GoogleTokens;
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.platform.update({
      where: { id: platformId },
      data: {
        accessToken: encrypt(tokens.access_token),
        tokenExpiresAt,
        lastSyncAt: new Date(),
      },
    });

    return tokens.access_token;
  }

  /**
   * Upload video to YouTube
   * Note: This is a simplified implementation. Full video upload requires 
   * resumable uploads for larger files.
   */
  async uploadVideo(
    platformId: string,
    _content: string,
    videoUrl: string,
    _options?: {
      title?: string;
      tags?: string[];
      categoryId?: string;
      privacyStatus?: 'public' | 'private' | 'unlisted';
    }
  ): Promise<{ postId: string; postUrl: string }> {
    // Note: Full video upload implementation would require:
    // 1. Downloading the video from the URL
    // 2. Using YouTube's resumable upload API
    // 3. Handling large file uploads in chunks
    
    logger.warn({ platformId, videoUrl }, 'YouTube video upload requires resumable upload implementation');
    
    throw new AppError(
      'YouTube video upload is not fully implemented. Videos need to be uploaded manually.',
      501,
      true,
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Create a YouTube Community Post (text post)
   * Note: Community posts require channel to have 500+ subscribers
   */
  async createCommunityPost(
    platformId: string,
    _content: string,
    _imageUrl?: string
  ): Promise<{ postId: string; postUrl: string }> {
    // YouTube Community Posts API is not publicly available
    // It's part of YouTube Studio and requires special access
    
    logger.warn({ platformId }, 'YouTube Community Posts API is not publicly available');
    
    throw new AppError(
      'YouTube Community Posts API is not publicly available. Please use YouTube Studio.',
      501,
      true,
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Get channel info
   */
  async getChannelInfo(platformId: string): Promise<YouTubeChannel | null> {
    const accessToken = await this.getValidAccessToken(platformId);
    
    const response = await fetch(
      `${YOUTUBE_API_URL}/channels?part=snippet,statistics&mine=true`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, platformId }, 'Failed to fetch YouTube channel info');
      return null;
    }

    interface YouTubeChannelResponse {
      items?: Array<{
        id: string;
        snippet: {
          title: string;
          customUrl?: string;
          thumbnails?: { default?: { url: string } };
        };
      }>;
    }

    const data = await response.json() as YouTubeChannelResponse;
    const items = data.items;
    if (!items || items.length === 0) {
      return null;
    }

    const item = items[0];
    if (!item) {
      return null;
    }
    
    return {
      id: item.id,
      title: item.snippet.title,
      customUrl: item.snippet.customUrl,
      thumbnails: item.snippet.thumbnails,
    };
  }
}

export const youtubeService = new YouTubeService();
