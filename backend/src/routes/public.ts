import { Router, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { twitterService } from '../services/twitter.service.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export const publicRouter = Router();

// Rate limiting for public routes (OAuth callbacks)
const publicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

publicRouter.use(publicLimiter);

// =============================================================================
// OAuth Callback Routes
// These routes must be publicly accessible for OAuth providers to redirect to
// =============================================================================

/**
 * GET /public/oauth/twitter/callback
 * Twitter/X OAuth callback
 */
publicRouter.get('/oauth/twitter/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Handle OAuth errors
    if (error) {
      logger.error({ error, error_description }, 'Twitter OAuth error');
      return res.redirect(`${env.CORS_ORIGIN}/platforms?error=${encodeURIComponent(String(error_description || error))}`);
    }

    if (!code || !state) {
      return res.redirect(`${env.CORS_ORIGIN}/platforms?error=${encodeURIComponent('Missing authorization code or state')}`);
    }

    // Exchange code for tokens
    const { userId, tokens } = await twitterService.exchangeCodeForTokens(
      String(code),
      String(state)
    );

    // Get Twitter user info
    const twitterUser = await twitterService.getUserInfo(tokens.access_token);

    // Save platform connection
    await twitterService.savePlatformConnection(userId, tokens, twitterUser);

    // Redirect to platforms page with success
    res.redirect(`${env.CORS_ORIGIN}/platforms?success=twitter`);
  } catch (err) {
    logger.error({ err }, 'Twitter OAuth callback error');
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.redirect(`${env.CORS_ORIGIN}/platforms?error=${encodeURIComponent(message)}`);
  }
});

/**
 * GET /public/oauth/linkedin/callback
 * LinkedIn OAuth callback
 */
publicRouter.get('/oauth/linkedin/callback', async (_req, res, next) => {
  try {
    // TODO: Implement LinkedIn OAuth callback
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /public/oauth/facebook/callback
 * Facebook OAuth callback
 */
publicRouter.get('/oauth/facebook/callback', async (_req, res, next) => {
  try {
    // TODO: Implement Facebook OAuth callback
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /public/oauth/instagram/callback
 * Instagram OAuth callback (uses Facebook)
 */
publicRouter.get('/oauth/instagram/callback', async (_req, res, next) => {
  try {
    // TODO: Implement Instagram OAuth callback
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /public/oauth/youtube/callback
 * YouTube/Google OAuth callback
 */
publicRouter.get('/oauth/youtube/callback', async (_req, res, next) => {
  try {
    // TODO: Implement YouTube OAuth callback
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /public/oauth/pinterest/callback
 * Pinterest OAuth callback
 */
publicRouter.get('/oauth/pinterest/callback', async (_req, res, next) => {
  try {
    // TODO: Implement Pinterest OAuth callback
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    next(error);
  }
});
