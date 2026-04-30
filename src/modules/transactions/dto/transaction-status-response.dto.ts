import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionResultDetailsDto {
  @ApiProperty({
    description: 'Ledger sequence where the transaction was confirmed',
    example: 123456,
  })
  ledger: number;

  @ApiProperty({
    description: 'Number of operations included in the transaction',
    example: 2,
  })
  operationCount: number;

  @ApiProperty({
    description: 'Source Stellar account that submitted the transaction',
    example: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
  })
  sourceAccount: string;

  @ApiProperty({
    description: 'Fee charged by the network, in stroops',
    example: '100',
  })
  feeCharged: string;

  @ApiProperty({
    description: 'Memo type reported by Horizon',
    example: 'text',
  })
  memoType: string;

  @ApiPropertyOptional({
    description: 'Memo value when present',
    example: 'Loan repayment',
    nullable: true,
  })
  memo?: string | null;

  @ApiProperty({
    description: 'Timestamp reported by Horizon for transaction creation/confirmation',
    example: '2026-03-23T05:15:30Z',
  })
  createdAt: string;
}

export class TransactionErrorDetailsDto {
  @ApiProperty({
    description: 'Normalized Stellar transaction error code',
    example: 'tx_insufficient_balance',
  })
  code: string;

  @ApiProperty({
    description: 'Human-readable description of the failure',
    example: 'Insufficient balance to cover this transaction.',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Operation-level result codes when Horizon exposes them',
    example: ['op_underfunded'],
    type: [String],
  })
  operationCodes?: string[];
}

export class TransactionStatusResponseDto {
  @ApiProperty({
    description: 'Stellar transaction hash',
    example: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  })
  hash: string;

  @ApiProperty({
    description: 'Normalized transaction status',
    enum: ['pending', 'success', 'failed'],
    example: 'success',
  })
  status: 'pending' | 'success' | 'failed';

  @ApiPropertyOptional({
    description: 'Application transaction type stored in the database when available',
    example: 'loan_repay',
    nullable: true,
  })
  type?: string | null;

  @ApiPropertyOptional({
    description: 'Parsed details for successful transactions',
    type: TransactionResultDetailsDto,
    nullable: true,
  })
  result?: TransactionResultDetailsDto | null;

  @ApiPropertyOptional({
    description: 'Failure details for rejected or unsuccessful transactions',
    type: TransactionErrorDetailsDto,
    nullable: true,
  })
  error?: TransactionErrorDetailsDto | null;

  @ApiPropertyOptional({
    description: 'Timestamp when the API first recorded the transaction locally',
    example: '2026-03-23T05:15:00.000Z',
    nullable: true,
  })
  submittedAt?: string | null;

  @ApiPropertyOptional({
    description: 'Timestamp when the transaction was confirmed on Stellar',
    example: '2026-03-23T05:15:30Z',
    nullable: true,
  })
  confirmedAt?: string | null;

  @ApiProperty({
    description: 'Timestamp of the latest status check performed by this API',
    example: '2026-03-23T05:16:00.000Z',
  })
  lastCheckedAt: string;
}
