import { ApiProperty } from '@nestjs/swagger';

export class LiquidityDepositPreviewDto {
  @ApiProperty({ description: 'Deposit amount in USD', example: 500 })
  depositAmount: number;

  @ApiProperty({
    description: 'Expected pool shares the user will receive',
    example: 462.9629629,
  })
  sharesReceived: number;

  @ApiProperty({
    description: 'Current pool share price in USD',
    example: 1.08,
  })
  currentSharePrice: number;

  @ApiProperty({
    description: 'Pool total value after this deposit',
    example: 2500500,
  })
  newTotalValue: number;

  @ApiProperty({
    description: 'Current total liquidity in the pool before deposit',
    example: 2500000,
  })
  currentTotalLiquidity: number;
}

export class LiquidityDepositResponseDto {
  @ApiProperty({
    description: 'Unsigned XDR transaction for the deposit() Soroban call',
    example: 'AAAAAgAAAAA...',
  })
  unsignedXdr: string;

  @ApiProperty({
    description: 'Human-readable transaction summary for the client UI',
    example: 'Deposit $500 into liquidity pool',
  })
  description: string;

  @ApiProperty({
    description: 'Preview of the deposit before the user signs the transaction',
    type: LiquidityDepositPreviewDto,
  })
  preview: LiquidityDepositPreviewDto;
}
