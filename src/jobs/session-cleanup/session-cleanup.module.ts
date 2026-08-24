import { Module } from '@nestjs/common';
import { SessionCleanupService } from './session-cleanup.service';
import { SupabaseService } from '../../database/supabase.client';

@Module({
  providers: [SessionCleanupService, SupabaseService],
})
export class SessionCleanupModule {}
