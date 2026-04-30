import { ApiProperty } from '@nestjs/swagger';

export class MarkAsReadResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 1 })
  updatedCount: number;
}
