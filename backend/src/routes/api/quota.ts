import { Router } from 'express';

export const quotaRouter = Router();

/**
 * GET /api/quota
 * Get quota usage for all platforms
 */
quotaRouter.get('/', async (req, res, next) => {
  try {
    // TODO: Implement get all quota usage
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/quota/:platformType
 * Get quota usage for a specific platform type
 */
quotaRouter.get('/:platformType', async (req, res, next) => {
  try {
    // TODO: Implement get platform quota
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/quota/check/:platformType
 * Check if posting is allowed (quota not exceeded)
 */
quotaRouter.get('/check/:platformType', async (req, res, next) => {
  try {
    // TODO: Implement quota check
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    next(error);
  }
});
