import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationPayload } from './notifications.service';

@WebSocketGateway({
  cors: {
    origin: [
      'https://uat-cfedfms.ultsglobal.com',
      'http://uat-cfedfms.ultsglobal.com',
      'http://localhost:7801',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  /** Map of userId → Set of socket IDs */
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialised');
  }

  async handleConnection(client: Socket) {
    try {
      const tokenString =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization;

      if (!tokenString) {
        throw new Error('No token provided');
      }

      const token = (tokenString as string).startsWith('Bearer ')
        ? (tokenString as string).split(' ')[1]
        : (tokenString as string);

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const userId: string = payload.sub;
      client.data.userId = userId;

      // Join a room named after the userId so we can target individuals
      await client.join(`user:${userId}`);

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      this.logger.log(`User ${userId} connected (socket ${client.id})`);
    } catch (err) {
      this.logger.warn(`Connection rejected for ${client.id}: ${(err as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      this.userSockets.get(userId)?.delete(client.id);
      if (this.userSockets.get(userId)?.size === 0) {
        this.userSockets.delete(userId);
      }
      this.logger.log(`User ${userId} disconnected (socket ${client.id})`);
    } else {
      this.logger.log(`Client disconnected: ${client.id}`);
    }
  }

  /** Send a notification to a specific user (all their active sockets) */
  sendToUser(userId: string, payload: NotificationPayload) {
    this.server.to(`user:${userId}`).emit('notification', {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  /** Broadcast to every connected client */
  broadcast(payload: NotificationPayload) {
    this.server.emit('notification', {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  /** Client can ping to check connection */
  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    client.emit('pong', { time: new Date().toISOString() });
  }
}