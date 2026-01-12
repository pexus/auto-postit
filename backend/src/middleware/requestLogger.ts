import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = randomUUID();
  req.requestId = requestId;
  
  const start = Date.now();
  
  // Log request
  logger.info({
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
  }, 'Incoming request');
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info({
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    }, 'Request completed');
  });
  
  next();
}
