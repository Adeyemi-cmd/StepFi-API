# Controllers Structure

## Base Structure

```typescript
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('module-name')
@Controller('module-name')
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @Get()
  @ApiOperation({ summary: 'Description' })
  @ApiResponse({ status: 200, description: 'Success' })
  async findAll() {
    return this.moduleService.findAll();
  }
}
```

## Standard Decorators

### Swagger
- `@ApiTags()`: Groups endpoints
- `@ApiOperation()`: Endpoint description
- `@ApiResponse()`: Documents responses
- `@ApiBearerAuth()`: For protected endpoints

### Routes
- `@Controller('route')`: Controller base route
- `@Get()`, `@Post()`, `@Patch()`, `@Delete()`: HTTP methods
- `@Param('id')`: Route parameters
- `@Body()`: Request body
- `@Query()`: Query parameters

### Security
- `@UseGuards(JwtAuthGuard)`: Protects endpoints
- `@UseGuards(WalletSignatureGuard)`: For wallet auth

## Conventions

- One controller per module
- Name: `{Module}Controller`
- File: `{module}.controller.ts`
- Maximum 10-15 endpoints per controller
- Use DTOs for input validation
