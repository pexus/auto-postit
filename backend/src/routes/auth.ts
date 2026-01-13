import { Router, Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authService } from '../services/auth.service.js';
import { mfaService } from '../services/mfa.service.js';
import { auditService } from '../services/audit.service.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth, requireAuthPendingMfa } from '../middleware/auth.js';
import {
  registerSchema,
  loginSchema,
  mfaVerifySchema,
  changePasswordSchema,
  disableMfaSchema,
} from '../schemas/auth.schema.js';
import { AuditAction } from '@prisma/client';
import argon2 from 'argon2';
import { prisma } from '../lib/prisma.js';
import { AuthenticationError } from '../middleware/errorHandler.js';

export const authRouter = Router();

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: { message: 'Too many attempts, please try again later', code: 'RATE_LIMIT' } },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper to get client info for audit logs
function getClientInfo(req: Request) {
  return {
    ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
  };
}

/**
 * GET /auth/setup-status
 * Check if initial setup is needed
 */
authRouter.get('/setup-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hasUsers = await authService.hasUsers();
    res.json({ setupRequired: !hasUsers });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/register
 * Register the initial user (only if no users exist)
 */
authRouter.post(
  '/register',
  authLimiter,
  validateBody(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, name } = req.body;
      const clientInfo = getClientInfo(req);

      const userId = await authService.createInitialUser({ email, password, name });

      // Set session
      req.session.userId = userId;
      req.session.mfaVerified = true; // No MFA yet, so consider verified

      await auditService.log({
        userId,
        action: AuditAction.LOGIN_SUCCESS,
        ...clientInfo,
        metadata: { method: 'register' },
      });

      res.status(201).json({
        message: 'Account created successfully',
        user: { id: userId, email, name },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /auth/login
 * Authenticate user with email and password
 */
authRouter.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const clientInfo = getClientInfo(req);

      const result = await authService.login({ email, password });

      // Set session
      req.session.userId = result.userId;
      req.session.mfaVerified = !result.mfaRequired;

      if (result.mfaRequired) {
        res.json({
          mfaRequired: true,
          message: 'MFA verification required',
        });
      } else {
        await auditService.log({
          userId: result.userId,
          action: AuditAction.LOGIN_SUCCESS,
          ...clientInfo,
        });

        const user = await authService.getUserById(result.userId);
        res.json({
          mfaRequired: false,
          user,
        });
      }
    } catch (error) {
      // Log failed login attempt
      const clientInfo = getClientInfo(req);
      await auditService.log({
        action: AuditAction.LOGIN_FAILURE,
        ...clientInfo,
        metadata: { email: req.body.email },
      });
      next(error);
    }
  }
);

/**
 * POST /auth/logout
 * Destroy session and log out user
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  const userId = req.session.userId;
  const clientInfo = getClientInfo(req);

  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: { message: 'Failed to logout', code: 'LOGOUT_ERROR' } });
      return;
    }

    if (userId) {
      auditService.log({
        userId,
        action: AuditAction.LOGOUT,
        ...clientInfo,
      });
    }

    res.clearCookie('autopostit.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

/**
 * GET /auth/session
 * Get current session info
 */
authRouter.get('/session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.session.userId) {
      const user = await authService.getUserById(req.session.userId);
      res.json({
        authenticated: true,
        mfaVerified: req.session.mfaVerified ?? false,
        user,
      });
    } else {
      res.json({
        authenticated: false,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/mfa/setup
 * Initialize MFA setup - generate secret and QR code
 */
authRouter.post(
  '/mfa/setup',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const result = await mfaService.generateSetup(userId);

      res.json({
        qrCodeDataUrl: result.qrCodeDataUrl,
        secret: result.secret, // Show for manual entry
        backupCodes: result.backupCodes,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /auth/mfa/enable
 * Enable MFA after verifying setup token
 */
authRouter.post(
  '/mfa/enable',
  requireAuth,
  validateBody(mfaVerifySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { code } = req.body;
      const clientInfo = getClientInfo(req);

      await mfaService.enableMfa(userId, code);

      await auditService.log({
        userId,
        action: AuditAction.MFA_ENABLED,
        ...clientInfo,
      });

      res.json({ message: 'MFA enabled successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /auth/mfa/verify
 * Verify MFA token during login
 */
authRouter.post(
  '/mfa/verify',
  requireAuthPendingMfa,
  validateBody(mfaVerifySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { code } = req.body;
      const clientInfo = getClientInfo(req);

      await mfaService.verifyCode(userId, code);

      // Mark session as MFA verified
      req.session.mfaVerified = true;

      await auditService.log({
        userId,
        action: AuditAction.MFA_VERIFIED,
        ...clientInfo,
      });

      await auditService.log({
        userId,
        action: AuditAction.LOGIN_SUCCESS,
        ...clientInfo,
        metadata: { method: 'mfa' },
      });

      const user = await authService.getUserById(userId);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /auth/mfa/disable
 * Disable MFA (requires current password)
 */
authRouter.post(
  '/mfa/disable',
  requireAuth,
  validateBody(disableMfaSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { password } = req.body;
      const clientInfo = getClientInfo(req);

      // Verify password first
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });

      if (!user) {
        throw new AuthenticationError('User not found');
      }

      const validPassword = await argon2.verify(user.passwordHash, password);
      if (!validPassword) {
        throw new AuthenticationError('Invalid password');
      }

      await mfaService.disableMfa(userId);

      await auditService.log({
        userId,
        action: AuditAction.MFA_DISABLED,
        ...clientInfo,
      });

      res.json({ message: 'MFA disabled successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /auth/mfa/backup-codes
 * Regenerate backup codes
 */
authRouter.post(
  '/mfa/backup-codes',
  requireAuth,
  validateBody(disableMfaSchema), // Requires password
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { password } = req.body;

      // Verify password first
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });

      if (!user) {
        throw new AuthenticationError('User not found');
      }

      const validPassword = await argon2.verify(user.passwordHash, password);
      if (!validPassword) {
        throw new AuthenticationError('Invalid password');
      }

      const backupCodes = await mfaService.regenerateBackupCodes(userId);

      res.json({ backupCodes });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /auth/change-password
 * Change password
 */
authRouter.post(
  '/change-password',
  requireAuth,
  validateBody(changePasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { currentPassword, newPassword } = req.body;
      const clientInfo = getClientInfo(req);

      await authService.changePassword(userId, currentPassword, newPassword);

      await auditService.log({
        userId,
        action: AuditAction.PASSWORD_CHANGED,
        ...clientInfo,
      });

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  }
);
