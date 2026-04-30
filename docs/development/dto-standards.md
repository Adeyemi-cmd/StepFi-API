# DTO Standards

## Base Structure

```typescript
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateModuleDto {
  @ApiProperty({ description: 'Field description' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Optional field' })
  @IsString()
  @IsOptional()
  description?: string;
}
```

## Validation

- Use `class-validator` decorators
- `@IsString()`, `@IsNumber()`, `@IsEmail()`, etc.
- `@IsNotEmpty()` for required fields
- `@IsOptional()` for optional fields
- `@Min()`, `@Max()` for numeric ranges

## Swagger Documentation

- `@ApiProperty()` for required fields
- `@ApiPropertyOptional()` for optional fields
- Include `description` in all fields
- Use `example` when useful

## Transformation

- Use `class-transformer` for transformations
- `@Transform()` for custom transformations
- `@Exclude()` to exclude fields from responses

## Conventions

- Name: `{Action}{Entity}Dto`
- Request: `CreateLoanDto`, `UpdateUserDto`
- Response: `LoanResponseDto`, `UserResponseDto`
- File: `{action}-{entity}.dto.ts`

## Wallet Validation

```typescript
@IsString()
@Matches(/^G[A-Z0-9]{55}$/, { message: 'Invalid Stellar wallet address' })
wallet: string;
```
