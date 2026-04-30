import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for requesting a nonce for wallet signature authentication.
 * Validates Stellar Ed25519 public key format (G + 55 base32 characters).
 */
export class NonceRequestDto {
  @ApiProperty({
    description: 'Stellar wallet address (Ed25519 public key, G + 55 chars)',
    example: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
    minLength: 56,
    maxLength: 56,
  })
  @IsString()
  @IsNotEmpty({ message: 'Wallet address is required' })
  @Matches(/^G[A-Z2-7]{55}$/, {
    message:
      'Invalid Stellar wallet address. Must start with G and have 55 base32 characters [A-Z2-7]',
  })
  wallet: string;
}
