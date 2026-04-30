import {
  IsString,
  IsOptional,
  MaxLength,
  Matches,
  ValidateNested,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    description: 'Enable in-app notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  notifications?: boolean;

  @ApiPropertyOptional({
    description: 'Preferred UI theme',
    enum: ['light', 'dark', 'system'],
    example: 'dark',
  })
  @IsOptional()
  @IsIn(['light', 'dark', 'system'], {
    message: 'Theme must be one of: light, dark, system',
  })
  theme?: 'light' | 'dark' | 'system';

  @ApiPropertyOptional({
    description: 'Preferred language (ISO 639-1 two-letter code)',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}$/, {
    message: 'Language must be a valid ISO 639-1 two-letter code (e.g. en, es)',
  })
  language?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Display name (max 100 characters)',
    example: 'Maria Garcia',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Name must be at most 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Avatar URL (must use HTTPS)',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsString()
  @Matches(/^https:\/\//, { message: 'Avatar URL must use HTTPS' })
  avatar?: string;

  @ApiPropertyOptional({
    description: 'User preferences',
    type: UpdatePreferencesDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePreferencesDto)
  preferences?: UpdatePreferencesDto;
}
