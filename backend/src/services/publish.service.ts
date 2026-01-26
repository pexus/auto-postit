import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { twitterService } from './twitter.service.js';
import { linkedInService } from './linkedin.service.js';
import { facebookService } from './facebook.service.js';
import { pinterestService } from './pinterest.service.js';
import { youtubeService } from './youtube.service.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

export interface PublishResult {
  platformId: string;
  success: boolean;
  postUrl?: string;
  error?: string;
}

class PublishService {
  /**
   * Resolve media file storage path to actual file path
   */
  private resolveMediaPath(storagePath: string): string {
    // storagePath format: "media:path/to/file.jpg" or "uploads:path/to/file.jpg"
    const parts = storagePath.split(':');
    const source = parts[0];
    const relativePath = parts.slice(1).join(':'); // Handle paths with colons
    const basePath = source === 'uploads' 
      ? path.resolve(process.cwd(), env.MEDIA_UPLOADS_PATH)
      : path.resolve(process.cwd(), env.MEDIA_PATH);
    return path.join(basePath, relativePath);
  }

  /**
   * Resolve media file storage path to a public URL
   * This is needed for platforms that require URLs instead of file uploads
   */
  private resolveMediaUrl(storagePath: string): string {
    // For now, construct a URL based on our API endpoint
    // In production, this could be a CDN URL
    const parts = storagePath.split(':');
    const source = parts[0];
    const relativePath = parts.slice(1).join(':');
    
    // Construct the URL using the FRONTEND_URL as the base
    // The backend serves static files at /uploads and /media endpoints
    const baseUrl = env.CORS_ORIGIN.replace(/\/$/, '');
    
    if (source === 'uploads') {
      return `${baseUrl}/api/media/uploads/${relativePath}`;
    }
    return `${baseUrl}/api/media/files/${relativePath}`;
  }

  /**
   * Upload media files for a platform and return Twitter media IDs
   * NOTE: Requires X API Pro tier ($5000/month) - disabled by default
   * Set TWITTER_MEDIA_UPLOAD_ENABLED=true in env to enable
   */
  private async uploadMediaForTwitter(
    platformId: string,
    mediaFiles: Array<{ mediaFile: { storagePath: string; mimeType: string } }>
  ): Promise<string[]> {
    // Check if Twitter media upload is enabled (requires paid API tier)
    if (!env.TWITTER_MEDIA_UPLOAD_ENABLED) {
      logger.info(
        { platformId, mediaCount: mediaFiles.length },
        'Twitter media upload is disabled (requires X API Pro tier). Posting text only. Set TWITTER_MEDIA_UPLOAD_ENABLED=true to enable.'
      );
      return [];
    }

    const mediaIds: string[] = [];

    for (const { mediaFile } of mediaFiles) {
      try {
        const filePath = this.resolveMediaPath(mediaFile.storagePath);
        const mediaBuffer = await fs.readFile(filePath);
        
        const mediaId = await twitterService.uploadMedia(
          platformId,
          mediaBuffer,
          mediaFile.mimeType
        );
        
        mediaIds.push(mediaId);
        logger.info({ platformId, mediaId, mimeType: mediaFile.mimeType }, 'Media uploaded to Twitter');
      } catch (error) {
        logger.error({ error, storagePath: mediaFile.storagePath }, 'Failed to upload media to Twitter');
        // Continue with other media files, don't fail the entire post
      }
    }

    return mediaIds;
  }

  /**
   * Publish a post to all selected platforms immediately
   */
  async publishNow(userId: string, postId: string): Promise<PublishResult[]> {
    // Get the post with all relations
    const post = await prisma.post.findFirst({
      where: { id: postId, userId },
      include: {
        platforms: {
          include: {
            platform: true,
          },
        },
        mediaFiles: {
          include: {
            mediaFile: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!post) {
      throw new Error('Post not found');
    }

    if (!['DRAFT', 'SCHEDULED', 'PUBLISHING'].includes(post.status)) {
      throw new Error('Can only publish draft, scheduled, or publishing posts');
    }

    if (post.platforms.length === 0) {
      throw new Error('Please select at least one platform before publishing');
    }

    // Update post status to PUBLISHING if not already
    if (post.status !== 'PUBLISHING') {
      await prisma.post.update({
        where: { id: postId },
        data: { status: 'PUBLISHING' },
      });
    }

    const results: PublishResult[] = [];

    // Publish to each platform
    for (const postPlatform of post.platforms) {
      const { platform } = postPlatform;
      const content = postPlatform.contentOverride || post.content;

      try {
        let postUrl: string | undefined;

        switch (platform.type) {
          case 'TWITTER':
            // Upload media files first if any
            let twitterMediaIds: string[] | undefined;
            if (post.mediaFiles.length > 0) {
              twitterMediaIds = await this.uploadMediaForTwitter(platform.id, post.mediaFiles);
              // Twitter allows max 4 images per tweet
              if (twitterMediaIds.length > 4) {
                twitterMediaIds = twitterMediaIds.slice(0, 4);
              }
            }
            
            const tweetResult = await twitterService.postTweet(
              platform.id, 
              content, 
              twitterMediaIds && twitterMediaIds.length > 0 ? twitterMediaIds : undefined
            );
            postUrl = tweetResult.tweetUrl;
            break;
          
          case 'LINKEDIN':
            const linkedInResult = await linkedInService.createPost(
              platform.id,
              content,
              post.mediaFiles.map(m => this.resolveMediaUrl(m.mediaFile.storagePath))
            );
            postUrl = linkedInResult.postUrl;
            break;
          
          case 'FACEBOOK':
            const facebookResult = await facebookService.createPost(
              platform.id,
              content,
              post.mediaFiles.map(m => this.resolveMediaUrl(m.mediaFile.storagePath))
            );
            postUrl = facebookResult.postUrl;
            break;
          
          case 'INSTAGRAM':
            // Instagram requires media
            if (post.mediaFiles.length === 0) {
              throw new Error('Instagram posts require at least one image or video');
            }
            const instagramResult = await facebookService.createInstagramPost(
              platform.id,
              content,
              post.mediaFiles.map(m => this.resolveMediaUrl(m.mediaFile.storagePath))
            );
            postUrl = instagramResult.postUrl;
            break;
          
          case 'PINTEREST':
            // Pinterest requires media
            if (post.mediaFiles.length === 0) {
              throw new Error('Pinterest pins require at least one image');
            }
            const pinterestResult = await pinterestService.createPin(
              platform.id,
              content,
              post.mediaFiles.map(m => this.resolveMediaUrl(m.mediaFile.storagePath))
            );
            postUrl = pinterestResult.postUrl;
            break;
          
          case 'YOUTUBE':
            // YouTube requires a video URL
            if (post.mediaFiles.length === 0) {
              throw new Error('YouTube posts require a video file');
            }
            const mediaFile = post.mediaFiles[0]!.mediaFile;
            const videoUrl = this.resolveMediaUrl(mediaFile.storagePath);
            const youtubeResult = await youtubeService.uploadVideo(
              platform.id,
              content,
              videoUrl
            );
            postUrl = youtubeResult.postUrl;
            break;
        }

        // Update platform status to published
        await prisma.postPlatform.update({
          where: { id: postPlatform.id },
          data: {
            status: 'PUBLISHED',
            platformPostUrl: postUrl,
            publishedAt: new Date(),
            errorMessage: null,
          },
        });

        results.push({
          platformId: platform.id,
          success: true,
          postUrl,
        });

        logger.info({ postId, platformId: platform.id, platformType: platform.type }, 'Published to platform');

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Update platform status to failed
        await prisma.postPlatform.update({
          where: { id: postPlatform.id },
          data: {
            status: 'FAILED',
            errorMessage,
          },
        });

        results.push({
          platformId: platform.id,
          success: false,
          error: errorMessage,
        });

        logger.error({ postId, platformId: platform.id, error: errorMessage }, 'Failed to publish to platform');
      }
    }

    // Determine final post status
    const allSucceeded = results.every(r => r.success);
    const allFailed = results.every(r => !r.success);
    const finalStatus = allSucceeded ? 'PUBLISHED' : allFailed ? 'FAILED' : 'PARTIALLY_PUBLISHED';

    // Update post status
    await prisma.post.update({
      where: { id: postId },
      data: {
        status: finalStatus,
        publishedAt: allSucceeded || !allFailed ? new Date() : null,
      },
    });

    return results;
  }
}

export const publishService = new PublishService();
