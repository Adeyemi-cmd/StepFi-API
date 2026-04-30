# Error Handling

## Error Structure

```typescript
{
  success: false,
  error: {
    code: string,
    message: string,
    statusCode: number,
    timestamp: string,
    path: string,
    details?: any
  }
}
```

## Error Codes

### Format
- **Code**: `MODULE_ACTION_ERROR`
- Examples: `AUTH_INVALID_SIGNATURE`, `LOAN_NOT_FOUND`, `BLOCKCHAIN_TX_FAILED`

### Categories
- `AUTH_*`: Authentication errors
- `VALIDATION_*`: Validation errors
- `NOT_FOUND_*`: Resources not found
- `BLOCKCHAIN_*`: Blockchain errors
- `DATABASE_*`: Database errors
- `EXTERNAL_*`: External service errors

## NestJS Exceptions

### BadRequestException (400)
```typescript
throw new BadRequestException({
  code: 'VALIDATION_INVALID_INPUT',
  message: 'Invalid input provided'
});
```

### UnauthorizedException (401)
```typescript
throw new UnauthorizedException({
  code: 'AUTH_INVALID_TOKEN',
  message: 'Invalid or expired token'
});
```

### NotFoundException (404)
```typescript
throw new NotFoundException({
  code: 'LOAN_NOT_FOUND',
  message: 'Loan not found'
});
```

### InternalServerErrorException (500)
```typescript
throw new InternalServerErrorException({
  code: 'DATABASE_CONNECTION_ERROR',
  message: 'Database connection failed'
});
```

## Exception Filter

- Centralize error formatting
- Automatic logging
- HTTP status code mapping
- Hide internal details in production
