import { ApiProperty } from '@nestjs/swagger';
import { LoanListStatusFilter } from './loan-list-query.dto';

export class LoanListMerchantDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', nullable: true })
  id: string | null;

  @ApiProperty({ example: 'TechStore', nullable: true })
  name: string | null;

  @ApiProperty({
    example: 'https://cdn.stepfi.app/merchants/techstore.png',
    nullable: true,
  })
  logo: string | null;
}

export class LoanNextPaymentDto {
  @ApiProperty({ example: '2026-04-29T00:00:00.000Z', nullable: true })
  dueDate: string | null;

  @ApiProperty({ example: 102.66, nullable: true })
  amount: number | null;
}

export class LoanListItemDto {
  @ApiProperty({ example: '11111111-2222-3333-4444-555555555555' })
  id: string;

  @ApiProperty({ example: 'chain-loan-1' })
  loanId: string;

  @ApiProperty({ example: 500 })
  amount: number;

  @ApiProperty({ example: 400 })
  loanAmount: number;

  @ApiProperty({ example: 100 })
  guarantee: number;

  @ApiProperty({ example: 8 })
  interestRate: number;

  @ApiProperty({ example: 410.67 })
  totalRepayment: number;

  @ApiProperty({ example: 205.34 })
  totalPaid: number;

  @ApiProperty({ example: 205.33 })
  remainingBalance: number;

  @ApiProperty({ example: 4 })
  term: number;

  @ApiProperty({ enum: LoanListStatusFilter, example: LoanListStatusFilter.ACTIVE })
  status: LoanListStatusFilter;

  @ApiProperty({ type: LoanListMerchantDto })
  merchant: LoanListMerchantDto;

  @ApiProperty({ type: LoanNextPaymentDto })
  nextPayment: LoanNextPaymentDto;

  @ApiProperty({ example: '2026-03-29T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-03-29T12:00:00.000Z', nullable: true })
  completedAt: string | null;

  @ApiProperty({ example: null, nullable: true })
  defaultedAt: string | null;
}

export class LoanListPaginationDto {
  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 0 })
  offset: number;

  @ApiProperty({ example: 42 })
  total: number;
}

export class LoanListResponseDto {
  @ApiProperty({ type: [LoanListItemDto] })
  data: LoanListItemDto[];

  @ApiProperty({ type: LoanListPaginationDto })
  pagination: LoanListPaginationDto;
}
