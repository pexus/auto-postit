import crypto from 'crypto';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/errorHandler.js';

// Facebook (Meta) OAuth 2.0 endpoints
const FACEBOOK_AUTH_URL = 'https://www.facebook.com/v18.0/dialog/oauth';
const FACEBOOK_TOKEN_URL = 'https://graph.facebook.com/v18.0/oauth/access_token';
const FACEBOOK_GRAPH_URL = 'https://graph.facebook.com/v18.0';

// Facebook permissions/scopes
const FACEBOOK_SCOPES = [
  'public_profile',
  'email',
  'pages_show_list', // List pages user manages
  'pages_read_engagement', // Read page engagement
  'pages_manage_posts', // Post to pages
  'instagram_basic', // Instagram basic info
  'instagram_content_publish', // Publish to Instagram
];

interface FacebookTokens {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface FacebookUser {
  id: string;
  name: string;
  email?: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category?: string;
}

interface InstagramAccount {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
}

// Store state temporarily for OAuth flow
const stateStore = new Map<string, { userId: string; type: 'FACEBOOK' | 'INSTAGRAM'; expiresAt: number }>();

class FacebookService {
  /**
   * Check if Facebook is configured
   */
  isConfigured(): boolean {
    return !!(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET && env.FACEBOOK_CALLBACK_URL);
  }

  /**
   * Generate OAuth authorization URL for Facebook Pages
   */
  getAuthorizationUrl(userId: string, type: 'FACEBOOK' | 'INSTAGRAM' = 'FACEBOOK'): string {
    if (!this.isConfigured()) {
      throw new AppError('Facebook OAuth is not configured', 503, true, 'FACEBOOK_NOT_CONFIGURED');
    }

    const state = crypto.randomBytes(16).toString('hex');
    
    stateStore.set(state, {
      userId,
      type,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    this.cleanupExpiredStates();

    const params = new URLSearchParams({
      client_id: env.FACEBOOK_APP_ID!,
      redirect_uri: env.FACEBOOK_CALLBACK_URL!,
      state,
      scope: FACEBOOK_SCOPES.join(','),
      response_type: 'code',
    });

    return `${FACEBOOK_AUTH_URL}?${params.toString()}`;
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

    const { userId, type } = stateData;
    stateStore.delete(state);

    // Exchange code for short-lived token
    const tokenUrl = new URL(FACEBOOK_TOKEN_URL);
    tokenUrl.searchParams.set('client_id', env.FACEBOOK_APP_ID!);
    tokenUrl.searchParams.set('client_secret', env.FACEBOOK_APP_SECRET!);
    tokenUrl.searchParams.set('redirect_uri', env.FACEBOOK_CALLBACK_URL!);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl.toString());
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      logger.error({ error }, 'Facebook token exchange failed');
      throw new AppError('Failed to exchange authorization code', 400, true, 'TOKEN_EXCHANGE_FAILED');
    }

    const shortLivedToken = await tokenResponse.json() as FacebookTokens;

    // Exchange for long-lived token (60 days)
    const longLivedTokenUrl = new URL(FACEBOOK_TOKEN_URL);
    longLivedTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedTokenUrl.searchParams.set('client_id', env.FACEBOOK_APP_ID!);
    longLivedTokenUrl.searchParams.set('client_secret', env.FACEBOOK_APP_SECRET!);
    longLivedTokenUrl.searchParams.set('fb_exchange_token', shortLivedToken.access_token);

    const longLivedResponse = await fetch(longLivedTokenUrl.toString());
    const longLivedToken: FacebookTokens = longLivedResponse.ok 
      ? await longLivedResponse.json() as FacebookTokens
      : shortLivedToken;

    // Get user info
    const userResponse = await fetch(
      `${FACEBOOK_GRAPH_URL}/me?fields=id,name,email,picture&access_token=${longLivedToken.access_token}`
    );

    if (!userResponse.ok) {
      const error = await userResponse.text();
      logger.error({ error }, 'Failed to fetch Facebook user info');
      throw new AppError('Failed to fetch Facebook user info', 400, true, 'USER_INFO_FAILED');
    }

    const fbUser = await userResponse.json() as FacebookUser;

    // Get pages managed by the user
    const pagesResponse = await fetch(
      `${FACEBOOK_GRAPH_URL}/me/accounts?fields=id,name,access_token,category&access_token=${longLivedToken.access_token}`
    );

    const pagesData = pagesResponse.ok ? await pagesResponse.json() as { data: FacebookPage[] } : { data: [] };
    const pages: FacebookPage[] = pagesData.data || [];

    // Token expires in ~60 days for long-lived token
    const tokenExpiresAt = new Date(Date.now() + (longLivedToken.expires_in || 60 * 24 * 60 * 60) * 1000);

    if (type === 'INSTAGRAM') {
      await this.handleInstagramCallback(userId, longLivedToken.access_token, pages, tokenExpiresAt);
    } else {
      await this.handleFacebookPagesCallback(userId, fbUser, pages, tokenExpiresAt);
    }
  }

  /**
   * Handle Instagram account connection
   */
  private async handleInstagramCallback(
    userId: string, 
    _accessToken: string, 
    pages: FacebookPage[],
    tokenExpiresAt: Date
  ): Promise<void> {
    // Find Instagram accounts connected to Facebook pages
    for (const page of pages) {
      const igResponse = await fetch(
        `${FACEBOOK_GRAPH_URL}/${page.id}?fields=instagram_business_account{id,username,name,profile_picture_url}&access_token=${page.access_token}`
      );

      if (!igResponse.ok) continue;

      const igData = await igResponse.json() as { instagram_business_account?: InstagramAccount };
      const igAccount: InstagramAccount | undefined = igData.instagram_business_account;

      if (igAccount) {
        const existingPlatform = await prisma.platform.findFirst({
          where: {
            userId,
            type: 'INSTAGRAM',
            platformUserId: igAccount.id,
          },
        });

        const platformData = {
          accessToken: encrypt(page.access_token), // Use page token for IG
          tokenExpiresAt,
          isActive: true,
          lastSyncAt: new Date(),
          metadata: {
            pageId: page.id,
            pageName: page.name,
          },
        };

        if (existingPlatform) {
          await prisma.platform.update({
            where: { id: existingPlatform.id },
            data: platformData,
          });
          logger.info({ userId, platformId: existingPlatform.id }, 'Instagram reconnected');
        } else {
          await prisma.platform.create({
            data: {
              userId,
              type: 'INSTAGRAM',
              name: igAccount.username || igAccount.name || 'Instagram',
              platformUserId: igAccount.id,
              platformUsername: igAccount.username,
              ...platformData,
            },
          });
          logger.info({ userId, igUsername: igAccount.username }, 'Instagram connected');
        }
      }
    }
  }

  /**
   * Handle Facebook Pages callback
   */
  private async handleFacebookPagesCallback(
    userId: string,
    fbUser: FacebookUser,
    pages: FacebookPage[],
    tokenExpiresAt: Date
  ): Promise<void> {
    // Save each page as a separate platform
    for (const page of pages) {
      const existingPlatform = await prisma.platform.findFirst({
        where: {
          userId,
          type: 'FACEBOOK',
          platformUserId: page.id,
        },
      });

      const platformData = {
        accessToken: encrypt(page.access_token), // Page access tokens don't expire if user token is long-lived
        tokenExpiresAt,
        isActive: true,
        lastSyncAt: new Date(),
        metadata: {
          category: page.category,
          fbUserId: fbUser.id,
        },
      };

      if (existingPlatform) {
        await prisma.platform.update({
          where: { id: existingPlatform.id },
          data: platformData,
        });
        logger.info({ userId, pageId: page.id }, 'Facebook Page reconnected');
      } else {
        await prisma.platform.create({
          data: {
            userId,
            type: 'FACEBOOK',
            name: page.name,
            platformUserId: page.id,
            platformUsername: page.name,
            ...platformData,
          },
        });
        logger.info({ userId, pageName: page.name }, 'Facebook Page connected');
      }
    }
  }

  /**
   * Post to a Facebook Page
   */
  async createPost(
    platformId: string, 
    content: string, 
    mediaUrls?: string[]
  ): Promise<{ postId: string; postUrl: string }> {
    const platform = await prisma.platform.findUnique({
      where: { id: platformId },
    });

    if (!platform) {
      throw new AppError('Platform not found', 404, true, 'PLATFORM_NOT_FOUND');
    }

    const accessToken = decrypt(platform.accessToken);
    const pageId = platform.platformUserId;

    let response: Response;
    
    if (mediaUrls && mediaUrls.length > 0 && mediaUrls[0]) {
      // Post with photo
      const params = new URLSearchParams();
      params.set('url', mediaUrls[0]);
      params.set('caption', content);
      params.set('access_token', accessToken);

      response = await fetch(`${FACEBOOK_GRAPH_URL}/${pageId}/photos`, {
        method: 'POST',
        body: params,
      });
    } else {
      // Text-only post
      const params = new URLSearchParams({
        message: content,
        access_token: accessToken,
      });

      response = await fetch(`${FACEBOOK_GRAPH_URL}/${pageId}/feed`, {
        method: 'POST',
        body: params,
      });
    }

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, platformId, status: response.status }, 'Failed to create Facebook post');
      throw new AppError(`Failed to create Facebook post: ${error}`, 400, true, 'POST_FAILED');
    }

    const result = await response.json() as { id?: string; post_id?: string };
    const postId = result.id || result.post_id || 'unknown';
    const postUrl = `https://www.facebook.com/${postId}`;

    logger.info({ platformId, postId }, 'Facebook post created successfully');
    
    return { postId, postUrl };
  }

  /**
   * Post to Instagram (requires business/creator account connected to FB page)
   */
  async createInstagramPost(
    platformId: string,
    content: string,
    mediaUrls: string[]
  ): Promise<{ postId: string; postUrl: string }> {
    if (!mediaUrls || mediaUrls.length === 0) {
      throw new AppError('Instagram posts require at least one image or video', 400, true, 'MEDIA_REQUIRED');
    }

    const platform = await prisma.platform.findUnique({
      where: { id: platformId },
    });

    if (!platform) {
      throw new AppError('Platform not found', 404, true, 'PLATFORM_NOT_FOUND');
    }

    const accessToken = decrypt(platform.accessToken);

    // Step 1: Create a media container
    const firstMediaUrl = mediaUrls[0];
    if (!firstMediaUrl) {
      throw new AppError('Media URL is required', 400, true, 'MEDIA_REQUIRED');
    }
    const mediaType = this.getMediaType(firstMediaUrl);
    const containerParams = new URLSearchParams({
      access_token: accessToken,
      caption: content,
    });

    if (mediaType === 'VIDEO') {
      containerParams.set('media_type', 'REELS'); // or VIDEO for feed videos
      containerParams.set('video_url', firstMediaUrl);
    } else {
      containerParams.set('image_url', firstMediaUrl);
    }

    const containerResponse = await fetch(
      `${FACEBOOK_GRAPH_URL}/${platform.platformUserId}/media`,
      {
        method: 'POST',
        body: containerParams,
      }
    );

    if (!containerResponse.ok) {
      const error = await containerResponse.text();
      logger.error({ error, platformId }, 'Failed to create Instagram media container');
      throw new AppError(`Failed to create Instagram media container: ${error}`, 400, true, 'CONTAINER_FAILED');
    }

    const containerResult = await containerResponse.json() as { id: string };
    const containerId = containerResult.id;

    // Step 2: Publish the media container
    // For videos, we may need to wait for processing
    if (mediaType === 'VIDEO') {
      await this.waitForMediaProcessing(platform.platformUserId, containerId, accessToken);
    }

    const publishParams = new URLSearchParams({
      access_token: accessToken,
      creation_id: containerId,
    });

    const publishResponse = await fetch(
      `${FACEBOOK_GRAPH_URL}/${platform.platformUserId}/media_publish`,
      {
        method: 'POST',
        body: publishParams,
      }
    );

    if (!publishResponse.ok) {
      const error = await publishResponse.text();
      logger.error({ error, platformId }, 'Failed to publish Instagram post');
      throw new AppError(`Failed to publish Instagram post: ${error}`, 400, true, 'PUBLISH_FAILED');
    }

    const publishResult = await publishResponse.json() as { id: string };
    const postId = publishResult.id;
    
    // Get permalink
    const permalinkResponse = await fetch(
      `${FACEBOOK_GRAPH_URL}/${postId}?fields=permalink&access_token=${accessToken}`
    );
    const permalinkData = permalinkResponse.ok ? await permalinkResponse.json() as { permalink?: string } : {};
    const postUrl = permalinkData.permalink || `https://www.instagram.com/p/${postId}`;

    logger.info({ platformId, postId }, 'Instagram post created successfully');
    
    return { postId, postUrl };
  }

  private getMediaType(url: string): 'IMAGE' | 'VIDEO' {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.webm'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext)) ? 'VIDEO' : 'IMAGE';
  }

  private async waitForMediaProcessing(
    _igUserId: string, 
    containerId: string, 
    accessToken: string,
    maxAttempts = 30
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const statusResponse = await fetch(
        `${FACEBOOK_GRAPH_URL}/${containerId}?fields=status_code&access_token=${accessToken}`
      );

      if (statusResponse.ok) {
        const status = await statusResponse.json() as { status_code?: string };
        if (status.status_code === 'FINISHED') {
          return;
        }
        if (status.status_code === 'ERROR') {
          throw new AppError('Instagram media processing failed', 400, true, 'PROCESSING_FAILED');
        }
      }

      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new AppError('Instagram media processing timeout', 408, true, 'PROCESSING_TIMEOUT');
  }
}

export const facebookService = new FacebookService();
