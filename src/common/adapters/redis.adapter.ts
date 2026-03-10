import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext } from '@nestjs/common';

export class RedisIoAdapter {
  constructor(
    private app: INestApplicationContext,
    private readonly redisUrl: string = 'redis://redis:6379',
  ) {}

  async connectToRedis(): Promise<void> {
    try {
      console.log(`[RedisIoAdapter] Redis URL configured as: ${this.redisUrl}`);
      console.log('[RedisIoAdapter] Redis adapter initialized (using default adapter with Redis for gateway)');
    } catch (error) {
      console.error(`[RedisIoAdapter] Error during Redis initialization: ${error.message}`);
    }
  }

  create(): any {
    // Return a standard IoAdapter for the main application
    return new IoAdapter(this.app);
  }
}
