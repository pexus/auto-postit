import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

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
publicRouter.get('/oauth/twitter/callback', async (_req, res, next) => {
  try {
    // TODO: Implement Twitter OAuth callback
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    next(error);
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
