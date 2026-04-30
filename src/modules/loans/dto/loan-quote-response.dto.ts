import { ApiProperty } from '@nestjs/swagger';

/** A single scheduled payment within a loan repayment plan */
export class SchedulePaymentDto {
  @ApiProperty({ description: 'Sequential payment number', example: 1 })
  paymentNumber: number;

  @ApiProperty({ description: 'Payment amount in USD', example: 108 })
  amount: number;

  @ApiProperty({
    description: 'Payment due date in ISO 8601 format',
    example: '2026-03-13T00:00:00.000Z',
  })
  dueDate: string;
}

/**
 * DTO for the loan quote response.
 * Contains the full breakdown of a BNPL loan: guarantee, loan amount,
 * interest rate, total repayment, and monthly schedule.
 */
export class LoanQuoteResponseDto {
  @ApiProperty({ description: 'Total purchase amount in USD', example: 500 })
  amount: number;

  @ApiProperty({
    description: 'Upfront guarantee deposit (20% of amount)',
    example: 100,
  })
  guarantee: number;

  @ApiProperty({
    description: 'Financed loan amount (80% of amount)',
    example: 400,
  })
  loanAmount: number;

  @ApiProperty({
    description: 'Annual interest rate percentage based on reputation',
    example: 8,
  })
  interestRate: number;

  @ApiProperty({
    description: 'Total amount to be repaid (loan + interest)',
    example: 410.67,
  })
  totalRepayment: number;

  @ApiProperty({ description: 'Loan term in months', example: 4 })
  term: number;

  @ApiProperty({
    description: 'Fixed monthly payment amount in USD',
    example: 102.67,
  })
  monthlyPayment: number;

  @ApiProperty({
    description: 'Monthly repayment schedule',
    type: [SchedulePaymentDto],
  })
  schedule: SchedulePaymentDto[];
}
