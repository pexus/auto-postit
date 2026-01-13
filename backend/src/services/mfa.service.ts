import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { env } from '../config/env.js';
import { AuthenticationError, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

// Configure TOTP settings
authenticator.options = {
  digits: 6,
  step: 30, // 30 second window
  window: 1, // Allow 1 step before/after for clock drift
};

const BACKUP_CODES_COUNT = 10;

export interface MfaSetupResult {
  secret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

export class MfaService {
  /**
   * Generate a new MFA secret and QR code for setup
   */
  async generateSetup(userId: string): Promise<MfaSetupResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, mfaEnabled: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.mfaEnabled) {
      throw new ValidationError('MFA is already enabled');
    }

    // Generate secret
    const secret = authenticator.generateSecret();

    // Generate OTP Auth URL for authenticator apps
    const otpAuthUrl = authenticator.keyuri(user.email, env.MFA_ISSUER, secret);

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    // Store encrypted secret and backup codes temporarily (not enabled yet)
    // They'll be persisted when user verifies with a valid code
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: encrypt(secret),
        mfaBackupCodes: backupCodes.map((code) => encrypt(code)),
      },
    });

    logger.info({ userId }, 'MFA setup initiated');

    return {
      secret,
      qrCodeDataUrl,
      backupCodes,
    };
  }

  /**
   * Enable MFA after user verifies with a valid TOTP code
   */
  async enableMfa(userId: string, code: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabled: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.mfaEnabled) {
      throw new ValidationError('MFA is already enabled');
    }

    if (!user.mfaSecret) {
      throw new ValidationError('MFA setup not initiated. Please start setup first.');
    }

    const secret = decrypt(user.mfaSecret);
    const isValid = authenticator.verify({ token: code, secret });

    if (!isValid) {
      throw new AuthenticationError('Invalid verification code');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaVerifiedAt: new Date(),
      },
    });

    logger.info({ userId }, 'MFA enabled');
  }

  /**
   * Verify TOTP code during login
   */
  async verifyCode(userId: string, code: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabled: true, mfaBackupCodes: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new ValidationError('MFA is not enabled');
    }

    const secret = decrypt(user.mfaSecret);

    // First, try to verify as TOTP code
    const isValidTotp = authenticator.verify({ token: code, secret });

    if (isValidTotp) {
      logger.info({ userId }, 'MFA verified with TOTP');
      return true;
    }

    // If not a valid TOTP, check if it's a backup code
    const normalizedCode = code.replace(/[-\s]/g, '').toLowerCase();
    const backupCodes = user.mfaBackupCodes.map((encrypted) => decrypt(encrypted));
    const backupIndex = backupCodes.findIndex(
      (bc) => bc.replace(/[-\s]/g, '').toLowerCase() === normalizedCode
    );

    if (backupIndex !== -1) {
      // Remove used backup code
      const updatedBackupCodes = [...user.mfaBackupCodes];
      updatedBackupCodes.splice(backupIndex, 1);

      await prisma.user.update({
        where: { id: userId },
        data: { mfaBackupCodes: updatedBackupCodes },
      });

      logger.info({ userId }, 'MFA verified with backup code');
      return true;
    }

    throw new AuthenticationError('Invalid verification code');
  }

  /**
   * Disable MFA (requires password verification done at route level)
   */
  async disableMfa(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.mfaEnabled) {
      throw new ValidationError('MFA is not enabled');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
        mfaVerifiedAt: null,
      },
    });

    logger.info({ userId }, 'MFA disabled');
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.mfaEnabled) {
      throw new ValidationError('MFA is not enabled');
    }

    const backupCodes = this.generateBackupCodes();

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaBackupCodes: backupCodes.map((code) => encrypt(code)),
      },
    });

    logger.info({ userId }, 'Backup codes regenerated');

    return backupCodes;
  }

  /**
   * Check if user has MFA enabled
   */
  async isMfaEnabled(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });

    return user?.mfaEnabled ?? false;
  }

  /**
   * Generate random backup codes
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];

    for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toLowerCase();
      // Format as xxxx-xxxx for readability
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }

    return codes;
  }
}

export const mfaService = new MfaService();
