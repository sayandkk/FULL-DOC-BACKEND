import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface SessionData {
  userId: string;
  sessionId: string;
  userAgent: string;
  ipAddress: string;
  loginTime: Date;
  lastActivity: Date;
  expiresAt: Date;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly sessions = new Map<string, SessionData>();
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private prisma: PrismaService) {}

  async createSession(
    userId: string,
    userAgent: string,
    ipAddress: string,
  ): Promise<SessionData> {
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.SESSION_TIMEOUT);

    const sessionData: SessionData = {
      userId,
      sessionId,
      userAgent,
      ipAddress,
      loginTime: now,
      lastActivity: now,
      expiresAt,
    };

    this.sessions.set(sessionId, sessionData);

    // Log session creation
    this.logger.log(`Session created for user ${userId}: ${sessionId}`);

    return sessionData;
  }

  async validateSession(sessionId: string): Promise<SessionData | null> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      this.sessions.delete(sessionId);
      this.logger.log(`Session expired: ${sessionId}`);
      return null;
    }

    // Update last activity
    session.lastActivity = new Date();
    this.sessions.set(sessionId, session);

    return session;
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.logger.log(
        `Session destroyed: ${sessionId} for user ${session.userId}`,
      );
    }
  }

  async getUserSessions(userId: string): Promise<SessionData[]> {
    const userSessions: SessionData[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId && new Date() <= session.expiresAt) {
        userSessions.push(session);
      }
    }

    return userSessions.sort(
      (a, b) => b.loginTime.getTime() - a.loginTime.getTime(),
    );
  }

  async cleanupExpiredSessions(): Promise<number> {
    let count = 0;
    const now = new Date();

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
        count++;
      }
    }

    if (count > 0) {
      this.logger.log(`Cleaned up ${count} expired sessions`);
    }

    return count;
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Security monitoring methods
  async detectSuspiciousActivity(
    userId: string,
    ipAddress: string,
  ): Promise<boolean> {
    const userSessions = await this.getUserSessions(userId);

    // Check for multiple sessions from different IPs
    const uniqueIPs = new Set(userSessions.map((s) => s.ipAddress));
    if (uniqueIPs.size > 3) {
      this.logger.warn(
        `Suspicious activity detected for user ${userId}: ${uniqueIPs.size} different IP addresses`,
      );
      return true;
    }

    // Check if this IP is new for this user
    const isNewIP = !userSessions.some((s) => s.ipAddress === ipAddress);
    if (isNewIP && userSessions.length > 0) {
      this.logger.warn(
        `New IP address detected for user ${userId}: ${ipAddress}`,
      );
      return true;
    }

    return false;
  }
}
