import crypto from 'crypto';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/errorHandler.js';

import type { Prisma } from '@prisma/client';

// LinkedIn OAuth 2.0 endpoints
const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const LINKEDIN_POST_URL = 'https://api.linkedin.com/v2/posts';
const LINKEDIN_ORGANIZATIONS_URL = 'https://api.linkedin.com/v2/organizationAcls';

// LinkedIn OAuth scopes
const LINKEDIN_PROFILE_SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social', // Post on behalf of user (personal profile)
];

const LINKEDIN_PAGE_SCOPES = [
  ...LINKEDIN_PROFILE_SCOPES,
  'w_organization_social', // Post on behalf of organization (pages)
  'r_organization_social', // Read organization info
];

interface LinkedInTokens {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
}

interface LinkedInUser {
  sub: string; // LinkedIn user URN (e.g., "urn:li:person:abc123")
  name: string;
  email?: string;
  picture?: string;
}

interface LinkedInOrganization {
  organizationalTarget: string; // URN: urn:li:organization:xxx
  role: string;
  state: string;
}

interface LinkedInOrgDetails {
  id: number;
  localizedName: string;
  vanityName?: string;
  logoV2?: {
    original?: string;
  };
}

// Store state temporarily for OAuth flow
const stateStore = new Map<string, { userId: string; expiresAt: number; includeOrganizations: boolean }>();

class LinkedInService {
  /**
   * Check if LinkedIn is configured
   */
  isConfigured(): boolean {
    return !!(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET && env.LINKEDIN_CALLBACK_URL);
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(userId: string, options?: { includeOrganizations?: boolean }): string {
    if (!this.isConfigured()) {
      throw new AppError('LinkedIn OAuth is not configured', 503, true, 'LINKEDIN_NOT_CONFIGURED');
    }

    const state = crypto.randomBytes(16).toString('hex');
    const includeOrganizations = options?.includeOrganizations ?? true;
    
    // Store state for verification
    stateStore.set(state, {
      userId,
      includeOrganizations,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    // Clean up expired states
    this.cleanupExpiredStates();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.LINKEDIN_CLIENT_ID!,
      redirect_uri: env.LINKEDIN_CALLBACK_URL!,
      state,
      scope: (includeOrganizations ? LINKEDIN_PAGE_SCOPES : LINKEDIN_PROFILE_SCOPES).join(' '),
    });

    return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Clean up expired state entries
   */
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
    const includeOrganizations = stateData.includeOrganizations;
    stateStore.delete(state);

    // Exchange code for tokens
    const tokenResponse = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.LINKEDIN_CALLBACK_URL!,
        client_id: env.LINKEDIN_CLIENT_ID!,
        client_secret: env.LINKEDIN_CLIENT_SECRET!,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      logger.error({ error }, 'LinkedIn token exchange failed');
      throw new AppError('Failed to exchange authorization code', 400, true, 'TOKEN_EXCHANGE_FAILED');
    }

    const tokens = await tokenResponse.json() as LinkedInTokens;

    // Get user info
    const userResponse = await fetch(LINKEDIN_USERINFO_URL, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      const error = await userResponse.text();
      logger.error({ error }, 'Failed to fetch LinkedIn user info');
      throw new AppError('Failed to fetch LinkedIn user info', 400, true, 'USER_INFO_FAILED');
    }

    const linkedInUser = await userResponse.json() as LinkedInUser;

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Save personal profile
    await this.saveOrUpdatePlatform(
      userId,
      linkedInUser.sub,
      `${linkedInUser.name} (Profile)`,
      linkedInUser.email ?? null,
      tokens,
      tokenExpiresAt,
      { type: 'profile' }
    );

    // Fetch and save organization pages the user administers
    if (includeOrganizations) {
      await this.fetchAndSaveOrganizations(userId, tokens.access_token, tokens, tokenExpiresAt);
    }
  }

  /**
   * Fetch organizations/pages the user can post to
   */
  private async fetchAndSaveOrganizations(
    userId: string,
    accessToken: string,
    tokens: LinkedInTokens,
    tokenExpiresAt: Date
  ): Promise<void> {
    try {
      // Get organizations where user has ADMINISTRATOR role
      const orgsResponse = await fetch(
        `${LINKEDIN_ORGANIZATIONS_URL}?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organizationalTarget))`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'LinkedIn-Version': '202401',
          },
        }
      );

      if (!orgsResponse.ok) {
        logger.warn('Could not fetch LinkedIn organizations - user may not have page admin permissions');
        return;
      }

      const orgsData = await orgsResponse.json() as { elements?: LinkedInOrganization[] };
      const organizations = orgsData.elements || [];

      for (const org of organizations) {
        const orgUrn = org.organizationalTarget;
        // Extract org ID from URN (urn:li:organization:123456)
        const orgIdMatch = orgUrn.match(/urn:li:organization:(\d+)/);
        if (!orgIdMatch) continue;

        const orgId = orgIdMatch[1];

        // Get organization details
        const orgDetailsResponse = await fetch(
          `https://api.linkedin.com/v2/organizations/${orgId}?projection=(id,localizedName,vanityName,logoV2)`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'LinkedIn-Version': '202401',
            },
          }
        );

        if (!orgDetailsResponse.ok) continue;

        const orgDetails = await orgDetailsResponse.json() as LinkedInOrgDetails;

        // Save organization as a separate platform
        await this.saveOrUpdatePlatform(
          userId,
          orgUrn,
          `${orgDetails.localizedName} (Page)`,
          orgDetails.vanityName ?? null,
          tokens,
          tokenExpiresAt,
          { type: 'organization', orgId: orgDetails.id }
        );

        logger.info({ userId, orgName: orgDetails.localizedName }, 'LinkedIn organization page connected');
      }
    } catch (error) {
      logger.error({ error }, 'Error fetching LinkedIn organizations');
      // Don't throw - personal profile is still connected
    }
  }

  /**
   * Save or update a LinkedIn platform connection
   */
  private async saveOrUpdatePlatform(
    userId: string,
    platformUserId: string,
    name: string,
    username: string | null,
    tokens: LinkedInTokens,
    tokenExpiresAt: Date,
    metadata: Prisma.InputJsonValue
  ): Promise<void> {
    const existingPlatform = await prisma.platform.findFirst({
      where: {
        userId,
        type: 'LINKEDIN',
        platformUserId,
      },
    });

    const platformData = {
      accessToken: encrypt(tokens.access_token),
      refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      tokenExpiresAt,
      isActive: true,
      lastSyncAt: new Date(),
      metadata,
    };

    if (existingPlatform) {
      await prisma.platform.update({
        where: { id: existingPlatform.id },
        data: platformData,
      });
      logger.info({ userId, platformId: existingPlatform.id }, 'LinkedIn platform reconnected');
    } else {
      await prisma.platform.create({
        data: {
          userId,
          type: 'LINKEDIN',
          name,
          platformUserId,
          platformUsername: username,
          ...platformData,
        },
      });
      logger.info({ userId, name }, 'LinkedIn platform connected');
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

    // Check if token needs refresh (within 5 minutes of expiry)
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

    const response = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: env.LINKEDIN_CLIENT_ID!,
        client_secret: env.LINKEDIN_CLIENT_SECRET!,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, platformId }, 'LinkedIn token refresh failed');
      
      await prisma.platform.update({
        where: { id: platformId },
        data: { isActive: false },
      });
      
      throw new AppError('Failed to refresh token. Please reconnect LinkedIn.', 401, true, 'TOKEN_REFRESH_FAILED');
    }

    const tokens = await response.json() as LinkedInTokens;
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.platform.update({
      where: { id: platformId },
      data: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : platform.refreshToken,
        tokenExpiresAt,
        lastSyncAt: new Date(),
      },
    });

    return tokens.access_token;
  }

  /**
   * Post to LinkedIn (profile or organization page)
   */
  async createPost(
    platformId: string, 
    content: string, 
    _mediaUrls?: string[]
  ): Promise<{ postId: string; postUrl: string }> {
    const accessToken = await this.getValidAccessToken(platformId);
    
    const platform = await prisma.platform.findUnique({
      where: { id: platformId },
    });

    if (!platform) {
      throw new AppError('Platform not found', 404, true, 'PLATFORM_NOT_FOUND');
    }

    // Determine if this is an organization or personal profile post
    // The platformUserId will be either:
    // - Personal: contains "person" (e.g., "abc123" or "urn:li:person:abc123")
    // - Organization: "urn:li:organization:123456"
    const isOrganization = platform.platformUserId.includes('organization');
    
    // Build the author URN
    let authorUrn = platform.platformUserId;
    if (!authorUrn.startsWith('urn:li:')) {
      // It's just the ID, need to construct the URN
      authorUrn = `urn:li:person:${authorUrn}`;
    }

    // Build post data
    const postData: Record<string, unknown> = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      visibility: 'PUBLIC',
      commentary: content,
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
    };

    const response = await fetch(LINKEDIN_POST_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202401',
      },
      body: JSON.stringify(postData),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, platformId, status: response.status, isOrganization }, 'Failed to create LinkedIn post');
      throw new AppError(`Failed to create LinkedIn post: ${error}`, 400, true, 'POST_FAILED');
    }

    // LinkedIn returns the post ID in the x-restli-id header
    const postId = response.headers.get('x-restli-id') || 'unknown';
    
    // Construct post URL
    const postUrl = `https://www.linkedin.com/feed/update/${postId}`;

    logger.info({ platformId, postId, isOrganization }, 'LinkedIn post created successfully');
    
    return { postId, postUrl };
  }
}

export const linkedInService = new LinkedInService();
