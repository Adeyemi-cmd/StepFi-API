import { IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for requesting a liquidity pool deposit preview + unsigned XDR.
 * Amount is in USD with a minimum deposit of 10 USD as required by the pool contract.
 */
export class LiquidityDepositRequestDto {
  @ApiProperty({
    description: 'Deposit amount in USD',
    example: 500,
    minimum: 10,
    maximum: 1000000,
  })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(10, { message: 'Minimum deposit amount is $10' })
  @Max(1000000, { message: 'Amount cannot exceed $1,000,000' })
  amount: number;
}
