import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../../database/supabase.client';

@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const client = this.supabaseService.getServiceRoleClient();

      // Delete only rows already past their expiry; the 1h grace window
      // mirrors the nonce-cleanup pattern and keeps rows around long enough
      // that an "expired" response (instead of "not found") is still
      // possible for borderline requests.
      const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { error, count } = await client
        .from('sessions')
        .delete({ count: 'exact' })
        .lt('expires_at', cutoff);

      if (error) {
        this.logger.error(`Failed to delete expired sessions: ${error.message}`);
        throw error;
      }

      this.logger.log(`Deleted ${count ?? 0} expired sessions`);
    } catch (error) {
      this.logger.error('Session cleanup failed', error);
    }
  }
}
