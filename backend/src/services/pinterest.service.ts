import crypto from 'crypto';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/errorHandler.js';

// Pinterest OAuth 2.0 endpoints
const PINTEREST_AUTH_URL = 'https://www.pinterest.com/oauth/';
const PINTEREST_TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token';
const PINTEREST_API_URL = 'https://api.pinterest.com/v5';

// Pinterest OAuth scopes
const PINTEREST_SCOPES = [
  'boards:read',
  'boards:write',
  'pins:read',
  'pins:write',
  'user_accounts:read',
];

interface PinterestTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_token_expires_in: number;
  scope: string;
}

interface PinterestUser {
  id: string;
  username: string;
  profile_image?: string;
  account_type?: string;
}

interface PinterestBoard {
  id: string;
  name: string;
  description?: string;
  privacy?: string;
}

// Store state temporarily for OAuth flow
const stateStore = new Map<string, { userId: string; expiresAt: number }>();

class PinterestService {
  /**
   * Check if Pinterest is configured
   */
  isConfigured(): boolean {
    return !!(env.PINTEREST_APP_ID && env.PINTEREST_APP_SECRET && env.PINTEREST_CALLBACK_URL);
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(userId: string): string {
    if (!this.isConfigured()) {
      throw new AppError('Pinterest OAuth is not configured', 503, true, 'PINTEREST_NOT_CONFIGURED');
    }

    const state = crypto.randomBytes(16).toString('hex');
    
    stateStore.set(state, {
      userId,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    this.cleanupExpiredStates();

    const params = new URLSearchParams({
      client_id: env.PINTEREST_APP_ID!,
      redirect_uri: env.PINTEREST_CALLBACK_URL!,
      response_type: 'code',
      scope: PINTEREST_SCOPES.join(','),
      state,
    });

    return `${PINTEREST_AUTH_URL}?${params.toString()}`;
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

    const userId = stateData.userId;
    stateStore.delete(state);

    // Exchange code for tokens using Basic auth
    const credentials = Buffer.from(`${env.PINTEREST_APP_ID}:${env.PINTEREST_APP_SECRET}`).toString('base64');
    
    const tokenResponse = await fetch(PINTEREST_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.PINTEREST_CALLBACK_URL!,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      logger.error({ error }, 'Pinterest token exchange failed');
      throw new AppError('Failed to exchange authorization code', 400, true, 'TOKEN_EXCHANGE_FAILED');
    }

    const tokens = await tokenResponse.json() as PinterestTokens;

    // Get user info
    const userResponse = await fetch(`${PINTEREST_API_URL}/user_account`, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      const error = await userResponse.text();
      logger.error({ error }, 'Failed to fetch Pinterest user info');
      throw new AppError('Failed to fetch Pinterest user info', 400, true, 'USER_INFO_FAILED');
    }

    const pinterestUser = await userResponse.json() as PinterestUser;

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Check if platform already exists
    const existingPlatform = await prisma.platform.findFirst({
      where: {
        userId,
        type: 'PINTEREST',
        platformUserId: pinterestUser.id,
      },
    });

    if (existingPlatform) {
      await prisma.platform.update({
        where: { id: existingPlatform.id },
        data: {
          accessToken: encrypt(tokens.access_token),
          refreshToken: encrypt(tokens.refresh_token),
          tokenExpiresAt,
          isActive: true,
          lastSyncAt: new Date(),
        },
      });
      logger.info({ userId, platformId: existingPlatform.id }, 'Pinterest reconnected');
    } else {
      await prisma.platform.create({
        data: {
          userId,
          type: 'PINTEREST',
          name: pinterestUser.username,
          platformUserId: pinterestUser.id,
          platformUsername: pinterestUser.username,
          accessToken: encrypt(tokens.access_token),
          refreshToken: encrypt(tokens.refresh_token),
          tokenExpiresAt,
          isActive: true,
          lastSyncAt: new Date(),
        },
      });
      logger.info({ userId, pinterestUsername: pinterestUser.username }, 'Pinterest connected');
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
    const credentials = Buffer.from(`${env.PINTEREST_APP_ID}:${env.PINTEREST_APP_SECRET}`).toString('base64');

    const response = await fetch(PINTEREST_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, platformId }, 'Pinterest token refresh failed');
      
      await prisma.platform.update({
        where: { id: platformId },
        data: { isActive: false },
      });
      
      throw new AppError('Failed to refresh token. Please reconnect Pinterest.', 401, true, 'TOKEN_REFRESH_FAILED');
    }

    const tokens = await response.json() as PinterestTokens;
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.platform.update({
      where: { id: platformId },
      data: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiresAt,
        lastSyncAt: new Date(),
      },
    });

    return tokens.access_token;
  }

  /**
   * Get user's boards
   */
  async getBoards(platformId: string): Promise<PinterestBoard[]> {
    const accessToken = await this.getValidAccessToken(platformId);
    
    const response = await fetch(`${PINTEREST_API_URL}/boards`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, platformId }, 'Failed to fetch Pinterest boards');
      throw new AppError('Failed to fetch boards', 400, true, 'BOARDS_FETCH_FAILED');
    }

    const data = await response.json() as { items?: PinterestBoard[] };
    return data.items || [];
  }

  /**
   * Create a Pin
   */
  async createPin(
    platformId: string,
    content: string,
    mediaUrls: string[],
    options?: {
      boardId?: string;
      link?: string;
      title?: string;
    }
  ): Promise<{ postId: string; postUrl: string }> {
    if (!mediaUrls || mediaUrls.length === 0 || !mediaUrls[0]) {
      throw new AppError('Pinterest pins require at least one image', 400, true, 'MEDIA_REQUIRED');
    }

    const accessToken = await this.getValidAccessToken(platformId);

    // If no board specified, get the first available board
    let boardId = options?.boardId;
    if (!boardId) {
      const boards = await this.getBoards(platformId);
      if (boards.length === 0 || !boards[0]) {
        throw new AppError('No Pinterest boards found. Please create a board first.', 400, true, 'NO_BOARDS');
      }
      boardId = boards[0].id;
    }

    // Create the pin
    const pinData: any = {
      board_id: boardId,
      media_source: {
        source_type: 'image_url',
        url: mediaUrls[0],
      },
      description: content,
    };

    if (options?.title) {
      pinData.title = options.title;
    }

    if (options?.link) {
      pinData.link = options.link;
    }

    const response = await fetch(`${PINTEREST_API_URL}/pins`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pinData),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, platformId, status: response.status }, 'Failed to create Pinterest pin');
      throw new AppError(`Failed to create Pinterest pin: ${error}`, 400, true, 'PIN_FAILED');
    }

    const result = await response.json() as { id: string };
    const postId = result.id;
    const postUrl = `https://www.pinterest.com/pin/${postId}/`;

    logger.info({ platformId, postId }, 'Pinterest pin created successfully');
    
    return { postId, postUrl };
  }
}

export const pinterestService = new PinterestService();
