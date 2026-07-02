import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SupabaseKeepAliveService } from './supabase-keepalive.service';
import { SupabaseKeepAliveProcessor } from './supabase-keepalive.processor';
import { SupabaseService } from '../../database/supabase.client';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'supabase-keepalive',
    }),
  ],
  providers: [
    SupabaseKeepAliveService,
    SupabaseKeepAliveProcessor,
    SupabaseService,
  ],
})
export class SupabaseKeepAliveModule {}
