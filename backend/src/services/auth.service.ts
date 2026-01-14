import argon2 from 'argon2';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { ConflictError, AuthenticationError, NotFoundError } from '../middleware/errorHandler.js';

// Argon2id configuration per OWASP recommendations
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
};

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  userId: string;
  mfaRequired: boolean;
}

export class AuthService {
  /**
   * Check if any users exist (for single-user setup flow)
   */
  async hasUsers(): Promise<boolean> {
    const count = await prisma.user.count();
    return count > 0;
  }

  /**
   * Create the initial user (only allowed if no users exist)
   */
  async createInitialUser(input: CreateUserInput): Promise<string> {
    const hasExistingUsers = await this.hasUsers();
    
    if (hasExistingUsers) {
      throw new ConflictError('User already exists. This is a single-user application.');
    }

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase().trim(),
        passwordHash,
        name: input.name?.trim() || null,
        isSetupComplete: true,
      },
    });

    logger.info({ userId: user.id }, 'Initial user created');
    return user.id;
  }

  /**
   * Authenticate user with email and password
   */
  async login(input: LoginInput): Promise<LoginResult> {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase().trim() },
    });

    if (!user) {
      // Use same error message to prevent user enumeration
      throw new AuthenticationError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new AuthenticationError('Account is disabled');
    }

    const validPassword = await argon2.verify(user.passwordHash, input.password, ARGON2_OPTIONS);

    if (!validPassword) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info({ userId: user.id }, 'User logged in');

    return {
      userId: user.id,
      mfaRequired: user.mfaEnabled,
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        mfaEnabled: true,
        isSetupComplete: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const validPassword = await argon2.verify(user.passwordHash, currentPassword, ARGON2_OPTIONS);

    if (!validPassword) {
      throw new AuthenticationError('Current password is incorrect');
    }

    const newPasswordHash = await argon2.hash(newPassword, ARGON2_OPTIONS);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    logger.info({ userId }, 'Password changed');
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: { name?: string; email?: string }): Promise<void> {
    const updateData: Record<string, string> = {};
    
    if (data.name !== undefined && data.name.trim()) {
      updateData.name = data.name.trim();
    }
    if (data.email !== undefined && data.email.trim()) {
      updateData.email = data.email.toLowerCase().trim();
    }
    
    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }

    logger.info({ userId }, 'Profile updated');
  }
}

export const authService = new AuthService();
