import { prisma } from '../lib/prisma.js';
import { AuditAction } from '@prisma/client';
import { logger } from '../lib/logger.js';

export interface AuditLogInput {
  userId?: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  /**
   * Create an audit log entry
   */
  async log(input: AuditLogInput): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: input.userId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: input.metadata ?? undefined,
        },
      });

      logger.debug({
        action: input.action,
        userId: input.userId,
        entityType: input.entityType,
        entityId: input.entityId,
      }, 'Audit log created');
    } catch (error) {
      // Don't throw on audit log failures - just log the error
      logger.error({ error, input }, 'Failed to create audit log');
    }
  }

  /**
   * Get audit logs for a user
   */
  async getLogsForUser(userId: string, limit: number = 50) {
    return prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get recent audit logs
   */
  async getRecentLogs(limit: number = 100) {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
    });
  }
}

export const auditService = new AuditService();
