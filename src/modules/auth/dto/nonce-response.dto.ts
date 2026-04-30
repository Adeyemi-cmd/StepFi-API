import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for the nonce endpoint.
 * Returns the generated nonce and its expiration time.
 */
export class NonceResponseDto {
  @ApiProperty({
    description: 'Cryptographically secure nonce to be signed by the wallet',
    example: 'a1b2c3d4e5f67890abcdef1234567890a1b2c3d4e5f67890abcdef1234567890',
  })
  nonce: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the nonce expires (5 minutes from creation)',
    example: '2026-02-13T10:05:00.000Z',
  })
  expiresAt: string;
}
