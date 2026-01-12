import { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from './errorHandler.js';

// Extend Express types for session
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    mfaVerified?: boolean;
  }
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Middleware to check if user is authenticated
 * Requires valid session with userId and MFA verification (if enabled)
 */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.session.userId) {
    throw new AuthenticationError('Please log in to continue');
  }
  
  // Check if MFA verification is required but not completed
  // This will be enforced once MFA is enabled for the user
  if (req.session.mfaVerified === false) {
    throw new AuthenticationError('MFA verification required');
  }
  
  req.userId = req.session.userId;
  next();
}

/**
 * Middleware to check if user is authenticated (MFA pending allowed)
 * Used for routes that need auth but are accessed during MFA flow
 */
export function requireAuthPendingMfa(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.session.userId) {
    throw new AuthenticationError('Please log in to continue');
  }
  
  req.userId = req.session.userId;
  next();
}
