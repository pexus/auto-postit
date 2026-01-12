import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

healthRouter.get('/ready', async (_req, res) => {
  // TODO: Check database and Redis connectivity
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});
