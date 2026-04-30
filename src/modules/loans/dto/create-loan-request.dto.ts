import { ApiProperty } from '@nestjs/swagger';
import { LoanQuoteRequestDto } from './loan-quote-request.dto';

export class CreateLoanRequestDto extends LoanQuoteRequestDto {
  @ApiProperty({
    description: 'Total purchase amount in USD',
    example: 500,
    minimum: 1,
    maximum: 10000,
  })
  amount: number;

  @ApiProperty({
    description: 'Merchant UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  merchant: string;

  @ApiProperty({
    description: 'Loan term in months (1-12)',
    example: 4,
    minimum: 1,
    maximum: 12,
  })
  term: number;
}
