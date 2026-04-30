import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class TransactionStatusCheckerService implements OnModuleInit {
  private readonly logger = new Logger(TransactionStatusCheckerService.name);

  constructor(
    @InjectQueue('transaction-status-checker')
    private readonly transactionCheckerQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    const existing = await this.transactionCheckerQueue.getRepeatableJobs();
    for (const job of existing) {
      await this.transactionCheckerQueue.removeRepeatableByKey(job.key);
    }

    await this.transactionCheckerQueue.add(
      'check-pending-transactions',
      {},
      {
        repeat: { every: 15_000 },
        removeOnComplete: { count: 20 },
        removeOnFail: { count: 50 },
      },
    );

    this.logger.log(
      {
        context: 'TransactionStatusCheckerService',
        action: 'onModuleInit',
      },
      'Transaction status checker scheduled — runs every 15 seconds',
    );
  }
}
