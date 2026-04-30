import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AuthModule } from '../auth/auth.module';
import { SupabaseService } from '../../database/supabase.client';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, SupabaseService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
