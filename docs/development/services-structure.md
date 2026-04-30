# Services Structure

## Base Structure

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class ModuleService {
  constructor(
    private readonly repository: ModuleRepository,
    private readonly blockchainService: BlockchainService,
  ) {}

  async findAll(): Promise<Module[]> {
    return this.repository.findAll();
  }
}
```

## Responsibilities

- **Business logic**: All logic should be here
- **Orchestration**: Coordinates calls to repositories, blockchain, other services
- **Business validations**: Rules that are not input validation
- **Transformations**: Converts data between layers

## Dependency Injection

- Use `constructor` to inject dependencies
- Type all dependencies
- Avoid circular dependencies

## Conventions

- Name: `{Module}Service`
- File: `{module}.service.ts`
- `@Injectable()` decorator always present
- Async methods when there's I/O
- Return explicit types (no `any`)

## Error Handling

- Throw specific NestJS exceptions
- Don't catch errors unless transforming them
- Let filters handle response formatting
