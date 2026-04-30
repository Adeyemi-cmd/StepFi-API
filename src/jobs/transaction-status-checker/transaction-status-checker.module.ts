import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { TransactionStatusCheckerService } from './transaction-status-checker.service';
import { TransactionStatusCheckerProcessor } from './transaction-status-checker.processor';
import { SupabaseService } from '../../database/supabase.client';

@Module({
  imports: [ConfigModule, BullModule.registerQueue({ name: 'transaction-status-checker' })],
  providers: [
    TransactionStatusCheckerService,
    TransactionStatusCheckerProcessor,
    SupabaseService,
  ],
})
export class TransactionStatusCheckerModule {}
