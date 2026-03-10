import { Injectable, Logger } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { PrismaService } from '../database/prisma.service';

export interface NotificationPayload {
  type:
    | 'WORKFLOW_APPROVAL'
    | 'WORKFLOW_REJECTED'
    | 'WORKFLOW_COMPLETED'
    | 'REQUEST_STATUS'
    | 'FILE_ASSIGNED'
    | 'GENERAL';
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
  link?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly gateway: NotificationsGateway,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Save a notification to the DB then emit to the user's socket room.
   * If the user is offline the record stays in the DB and is loaded on next login.
   */
  async notifyUser(userId: string, payload: NotificationPayload) {
    this.logger.log(`→ [${payload.type}] to user ${userId}: ${payload.title}`);

    try {
      // Persist first
      const saved = await (this.prisma as any).notification.create({
        data: {
          userId,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          entityId: payload.entityId,
          entityType: payload.entityType,
          link: payload.link,
          read: false,
        },
      });

      // Then emit real-time (no-op if user is offline)
      this.gateway.sendToUser(userId, {
        ...payload,
        id: saved.id,
      } as any);

      return saved;
    } catch (err) {
      this.logger.error(`Failed to save notification for user ${userId}: ${(err as Error).message}`);
      // Still try to emit even if DB failed
      this.gateway.sendToUser(userId, payload as any);
    }
  }

  /**
   * Broadcast a notification to all connected clients (NOT persisted per-user).
   */
  broadcast(payload: NotificationPayload) {
    this.logger.log(`→ [BROADCAST][${payload.type}]: ${payload.title}`);
    this.gateway.broadcast(payload);
  }

  /** Return the latest 50 unread + 20 read notifications for a user */
  async findForUser(userId: string) {
    return (this.prisma as any).notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Mark a single notification read (only if it belongs to userId) */
  async markRead(id: string, userId: string) {
    return (this.prisma as any).notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  /** Mark all notifications read for a user */
  async markAllRead(userId: string) {
    return (this.prisma as any).notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  /** Delete a notification (only if it belongs to userId) */
  async dismiss(id: string, userId: string) {
    return (this.prisma as any).notification.deleteMany({
      where: { id, userId },
    });
  }
}