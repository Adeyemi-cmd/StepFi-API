# Guards and Filters Standards

## Guards

### Base Structure

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class CustomGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    // Validation logic
    return true;
  }
}
```

### JWT Guard

`JwtAuthGuard` extends `AuthGuard('jwt')` from `@nestjs/passport` and delegates to `JwtStrategy`.

- Apply `@UseGuards(JwtAuthGuard)` to any protected endpoint
- `JwtStrategy` extracts the `Bearer` token from the `Authorization` header, verifies it with `JWT_SECRET`, and sets `req.user = { wallet: string }`
- Access the authenticated user in a controller via `@CurrentUser() user: { wallet: string }`
- Error handling in `handleRequest()`:
  - Expired token → `401 AUTH_TOKEN_EXPIRED`
  - Missing, invalid, or malformed token → `401 AUTH_TOKEN_INVALID`
- Only tokens with `type === 'access'` are accepted (refresh tokens are rejected)

### Wallet Signature Guard

- Validate wallet signature
- Verify nonce
- Validate Stellar wallet format

## Exception Filters

### Base Structure

```typescript
import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // Format error response
    response.status(status).json({
      success: false,
      error: { ... }
    });
  }
}
```

### Global Application

```typescript
// app.module.ts
providers: [
  {
    provide: APP_FILTER,
    useClass: HttpExceptionFilter,
  },
]
```

## Conventions

- Name: `{Purpose}Guard` or `{Purpose}Filter`
- File: `{purpose}.guard.ts` or `{purpose}.filter.ts`
- Guards for authorization and authentication
- Filters for response formatting and logging
