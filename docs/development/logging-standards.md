# Logging Standards

## Log Levels

- **error**: Errors requiring attention
- **warn**: Warnings, unusual situations
- **info**: General flow information
- **debug**: Detailed debugging information

## Structured Format

```typescript
logger.info({
  context: 'ModuleService',
  action: 'createLoan',
  wallet: 'G...',
  loanId: '123',
  metadata: { ... }
}, 'Loan created successfully');
```

## Context

- Always include `context`: Service/class name
- Include `action`: Action performed
- Add relevant data as metadata

## Request Logging

- Log at start: method, route, relevant headers
- Log at end: status code, response time
- Don't log sensitive data (tokens, secrets)

## Error Logging

```typescript
logger.error({
  context: 'ModuleService',
  action: 'processTransaction',
  error: error.message,
  stack: error.stack,
  metadata: { ... }
}, 'Failed to process transaction');
```

## Pino Logger

- Use injected logger from NestJS
- Configure format with `pino-pretty` in development
- Send structured logs to Sentry in production
