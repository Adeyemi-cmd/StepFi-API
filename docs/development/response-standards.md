# Response Standards

## Success Response

### Standard Structure

```typescript
{
  success: true,
  data: T,
  message?: string,
  meta?: {
    timestamp: string,
    requestId: string
  }
}
```

### Example

```typescript
{
  success: true,
  data: {
    id: "123",
    name: "John Doe"
  },
  message: "User retrieved successfully",
  meta: {
    timestamp: "2024-01-01T00:00:00Z",
    requestId: "req_abc123"
  }
}
```

## HTTP Status Codes

- `200 OK`: Successful operation
- `201 Created`: Resource created
- `204 No Content`: Success without content

## Paginated Responses

```typescript
{
  success: true,
  data: T[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}
```

## List Responses

```typescript
{
  success: true,
  data: T[],
  count: number
}
```

## Implementation

- Use DTOs for typed responses
- Apply automatic transformation with `class-transformer`
- Include metadata when relevant
