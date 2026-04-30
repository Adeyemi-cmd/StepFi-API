import { ApiProperty } from '@nestjs/swagger';

export class PoolOverviewResponseDto {
  @ApiProperty({
    description: 'Total liquidity in the pool (in USD/USDC)',
    example: 1500000,
  })
  totalLiquidity: number;

  @ApiProperty({
    description: 'Current Estimated APY based on active loans',
    example: 8.5,
  })
  apy: number;

  @ApiProperty({
    description: 'Pool utilization rate (Total Loaned / Total Liquidity * 100)',
    example: 65.2,
  })
  utilization: number;

  @ApiProperty({
    description: 'Total unique liquidity providers',
    example: 245,
  })
  totalInvestors: number;

  @ApiProperty({
    description: 'Number of currently active loans',
    example: 124,
  })
  activeLoans: number;
}
