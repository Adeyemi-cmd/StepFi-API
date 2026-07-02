import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SupabaseService } from '../../database/supabase.client';

@Processor('supabase-keepalive')
export class SupabaseKeepAliveProcessor extends WorkerHost {
  private readonly logger = new Logger(SupabaseKeepAliveProcessor.name);

  constructor(private readonly supabaseService: SupabaseService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`[SupabaseKeepAlive] Running job ${job.id}`);

    const client = this.supabaseService.getServiceRoleClient();

    // Lightweight read (equivalent to `SELECT 1 FROM users LIMIT 1`) that keeps
    // the Supabase project active so the free tier does not pause it for
    // inactivity. `head: true` executes the query without transferring rows.
    const { error } = await client
      .from('users')
      .select('*', { head: true })
      .limit(1);

    if (error) {
      this.logger.error(`[SupabaseKeepAlive] Ping failed: ${error.message}`);
      throw error;
    }

    this.logger.log('Supabase keep-alive ping successful');
  }
}
