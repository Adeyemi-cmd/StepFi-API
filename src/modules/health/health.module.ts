import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { StellarTomlController } from './stellar-toml.controller';
import { HealthService } from './health.service';
import { SupabaseService } from '../../database/supabase.client';

@Module({
  controllers: [HealthController, StellarTomlController],
  providers: [HealthService, SupabaseService],
})
export class HealthModule {}
