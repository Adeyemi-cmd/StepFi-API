import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO returned after successfully submitting a transaction to the Stellar network.
 */
export class SubmitTransactionResponseDto {
  @ApiProperty({
    description: 'Stellar transaction hash',
    example: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  })
  transactionHash: string;

  @ApiProperty({
    description: 'Transaction status immediately after submission',
    example: 'pending',
  })
  status: 'pending';
}
