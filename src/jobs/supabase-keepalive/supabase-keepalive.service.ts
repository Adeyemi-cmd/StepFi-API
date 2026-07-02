import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class SupabaseKeepAliveService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseKeepAliveService.name);

  constructor(
    @InjectQueue('supabase-keepalive') private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    await this.queue.remove('supabase-keepalive-job');
    await this.queue.add(
      'supabase-keepalive-job',
      {},
      {
        repeat: { pattern: '0 0 */3 * *' }, // Every 3 days (72 hours)
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 50 },
      },
    );
    this.logger.log('Supabase keep-alive job scheduled — runs every 3 days');
  }
}
