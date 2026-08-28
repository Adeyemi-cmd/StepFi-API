# API Endpoints Reference

Complete reference for all StepFi API endpoints. See [ROADMAP.md](../../ROADMAP.md) for implementation status.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://api.stepfi.io` *(to be deployed)*

## Authentication

Most endpoints require JWT authentication. Include the access token in the Authorization header:

```http
Authorization: Bearer <access_token>
```

---

## Phase 1: Authentication

### POST /auth/nonce

Generate a nonce and the canonical StepFi challenge message for wallet signature authentication.

**Request**:
```json
{
  "wallet": "GABC...XYZ"
}
```

**Response** (201 Created):
```json
{
  "nonce": "a1b2c3d4e5f67890abcdef1234567890a1b2c3d4e5f67890abcdef1234567890",
  "expiresAt": "2026-02-13T10:05:00.000Z",
  "message": "{\n  \"domain\": \"stepfi-api.onrender.com\",\n  \"address\": \"GABC...XYZ\",\n  \"statement\": \"StepFi requests that you sign this message to authenticate your wallet. This message does not trigger any blockchain transaction.\",\n  \"uri\": \"https://stepfi-api.onrender.com/api/v1/auth/verify\",\n  \"version\": \"1.0.0\",\n  \"nonce\": \"a1b2c3d4e5f67890abcdef1234567890a1b2c3d4e5f67890abcdef1234567890\",\n  \"issuedAt\": \"2026-02-13T10:00:00.000Z\",\n  \"expirationTime\": \"2026-02-13T10:05:00.000Z\",\n  \"networkPassphrase\": \"Test SDF Network ; September 2015\"\n}"
}
```

The `message` field is the exact text the wallet must sign. It binds the
signature to StepFi's domain, URI, wallet address, nonce and network, so a
signature captured from any other context cannot be replayed here. A SHA-256
digest of this message is stored on the nonce row, and verification only ever
accepts a signature over a message whose digest matches the stored challenge.

**Errors**:
- `400`: Invalid wallet format

---

### POST /auth/verify

Verify wallet signature and receive JWT tokens.

**Request**:
```json
{
  "wallet": "GABC...XYZ",
  "signature": "base64-ed25519-signature",
  "nonce": "a1b2c3d4e5f67890abcdef1234567890a1b2c3d4e5f67890abcdef1234567890",
  "signatureType": "envelope",
  "message": "{\n  \"domain\": \"stepfi-api.onrender.com\",\n  ... same envelope returned by /auth/nonce ...\n}"
}
```

`signatureType` selects exactly one verification scheme (the server never
tries multiple formats):

- `envelope` — native clients: raw Ed25519 over the canonical envelope UTF-8
  text returned by `/auth/nonce`.
- `sep0043` — browser wallets (Freighter): Ed25519 over
  `SHA-256("Stellar Signed Message:\n" + envelope)` (SEP-53).
- `raw` — **deprecated** legacy scheme: raw Ed25519 over the bare nonce hex.
  Only accepted while `AUTH_ALLOW_LEGACY_RAW_SIGNATURES=true` (migration
  window, sunset **2026-10-31**). The sunset is enforced at runtime: after
  that date legacy signatures are rejected with
  `AUTH_LEGACY_SIGNATURE_DISABLED` even if the flag is still true (override
  via `AUTH_LEGACY_SIGNATURES_SUNSET`).

`message` is optional: when omitted, the server reconstructs the canonical
challenge from the stored nonce row. Either way the signature is verified
against a message whose digest matches the challenge stored with the nonce —
client-supplied alternatives are rejected (`AUTH_CHALLENGE_MISMATCH`), as are
messages bound to a foreign domain/URI/network
(`AUTH_CHALLENGE_DOMAIN_MISMATCH`, `AUTH_CHALLENGE_URI_MISMATCH`,
`AUTH_CHALLENGE_NETWORK_MISMATCH`) or expired envelopes (`AUTH_NONCE_EXPIRED`).

**Response** (200 OK):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

**Errors**:
- `400`: Validation failed (wallet, nonce, signature, or signatureType)
- `401`: Nonce not found/already used (`AUTH_NONCE_NOT_FOUND`), expired
  (`AUTH_NONCE_EXPIRED`), or signature invalid
  (`AUTH_SIGNATURE_INVALID` / `AUTH_CHALLENGE_*`)

---

### POST /auth/refresh

Refresh access token using refresh token.

**Status**: 🔴 Not Implemented

**Request**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** (200 OK):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

---

## Phase 2: User Profile

### GET /users/me

Get authenticated user's profile.

**Status**: 🔴 Not Implemented (API-04)

**Authentication**: Required

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "wallet": "GABC...XYZ",
    "name": "Maria Garcia",
    "avatar": "https://...",
    "preferences": {
      "notifications": true,
      "theme": "dark",
      "language": "en"
    },
    "createdAt": "2026-01-15T10:00:00.000Z"
  },
  "message": "User retrieved successfully"
}
```

---

### PATCH /users/me

Update user profile.

**Status**: 🔴 Not Implemented (API-05)

**Authentication**: Required

**Request**:
```json
{
  "name": "Maria Rodriguez",
  "avatar": "https://...",
  "preferences": {
    "notifications": false
  }
}
```

**Response** (200 OK):
```json
{
  "wallet": "GABC...XYZ",
  "name": "Maria Rodriguez",
  "avatar": "https://...",
  "preferences": {
    "notifications": false,
    "theme": "dark"
  },
  "updatedAt": "2026-02-13T10:00:00.000Z"
}
```

---

## Phase 3: Merchants

### GET /merchants

List all active merchants.

**Status**: 🔴 Not Implemented (API-06)

**Authentication**: Required

**Query Parameters**:
- `limit` (number, default: 20): Items per page
- `offset` (number, default: 0): Skip items

**Response** (200 OK):
```json
{
  "merchants": [
    {
      "id": "merchant-1",
      "wallet": "GMER...ABC",
      "name": "TechStore",
      "logo": "https://...",
      "category": "Electronics",
      "isActive": true
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

---

### GET /merchants/:id

Get merchant details.

**Status**: 🔴 Not Implemented (API-07)

**Authentication**: Required

**Response** (200 OK):
```json
{
  "id": "merchant-1",
  "wallet": "GMER...ABC",
  "name": "TechStore",
  "logo": "https://...",
  "description": "Electronics retailer",
  "category": "Electronics",
  "website": "https://techstore.com",
  "isActive": true,
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

**Errors**:
- `404`: Merchant not found

---

## Phase 4: Reputation

### GET /reputation/:wallet

Get reputation score for a wallet.

**Status**: 🔴 Not Implemented (API-08)

**Authentication**: Required

**Response** (200 OK):
```json
{
  "wallet": "GABC...XYZ",
  "score": 75,
  "tier": "Good",
  "interestRate": 8,
  "maxCredit": 3000,
  "lastUpdated": "2026-02-10T15:30:00.000Z"
}
```

---

### GET /reputation/me

Get authenticated user's reputation.

**Status**: 🔴 Not Implemented (API-08)

**Authentication**: Required

**Response** (200 OK):
```json
{
  "wallet": "GABC...XYZ",
  "score": 75,
  "tier": "Good",
  "interestRate": 8,
  "maxCredit": 3000,
  "history": [
    {
      "timestamp": "2026-02-10T15:30:00.000Z",
      "oldScore": 70,
      "newScore": 75,
      "reason": "Loan repayment completed"
    }
  ]
}
```

---

## Phase 5: Loans

### POST /loans/quote

Calculate loan terms without creating it.

**Status**: 🔴 Not Implemented (API-10)

**Authentication**: Required

**Request**:
```json
{
  "amount": 500,
  "merchant": "merchant-1",
  "term": 4
}
```

**Response** (200 OK):
```json
{
  "amount": 500,
  "guarantee": 100,
  "loanAmount": 400,
  "interestRate": 8,
  "totalRepayment": 432,
  "term": 4,
  "schedule": [
    {
      "paymentNumber": 1,
      "amount": 108,
      "dueDate": "2026-03-13T00:00:00.000Z"
    },
    {
      "paymentNumber": 2,
      "amount": 108,
      "dueDate": "2026-04-13T00:00:00.000Z"
    },
    {
      "paymentNumber": 3,
      "amount": 108,
      "dueDate": "2026-05-13T00:00:00.000Z"
    },
    {
      "paymentNumber": 4,
      "amount": 108,
      "dueDate": "2026-06-13T00:00:00.000Z"
    }
  ]
}
```

---

### POST /loans/create

Create a new loan (returns unsigned XDR).

**Status**: 🔴 Not Implemented (API-11)

**Authentication**: Required

**Request**:
```json
{
  "amount": 500,
  "merchant": "merchant-1",
  "guarantee": 100,
  "term": 4
}
```

**Response** (200 OK):
```json
{
  "loanId": "loan-123",
  "xdr": "AAAAAgAAAAC...",
  "description": "Create loan for $500 at TechStore"
}
```

**Errors**:
- `400`: Invalid amount, insufficient reputation
- `404`: Merchant not found

---

### POST /loans/:loanId/repay

Make a payment on existing loan (returns unsigned XDR).

**Status**: 🔴 Not Implemented (API-12)

**Authentication**: Required

**Request**:
```json
{
  "amount": 108
}
```

**Response** (200 OK):
```json
{
  "xdr": "AAAAAgAAAAC...",
  "remainingBalance": 324,
  "nextPaymentDue": "2026-04-13T00:00:00.000Z",
  "description": "Repay $108 on loan loan-123"
}
```

---

### GET /loans/me

List authenticated user's loans.

**Status**: 🔴 Not Implemented (API-13)

**Authentication**: Required

**Query Parameters**:
- `status` (string, optional): Filter by status (active, completed, defaulted)
- `limit` (number, default: 20)
- `offset` (number, default: 0)

**Response** (200 OK):
```json
{
  "loans": [
    {
      "id": "loan-123",
      "merchant": {
        "id": "merchant-1",
        "name": "TechStore"
      },
      "amount": 500,
      "loanAmount": 400,
      "guarantee": 100,
      "totalRepayment": 432,
      "remainingBalance": 324,
      "status": "active",
      "nextPaymentDue": "2026-03-13T00:00:00.000Z",
      "createdAt": "2026-02-13T10:00:00.000Z"
    }
  ],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

---

### GET /loans/:loanId

Get loan details.

**Status**: 🔴 Not Implemented

**Authentication**: Required

**Response** (200 OK):
```json
{
  "id": "loan-123",
  "user": "GABC...XYZ",
  "merchant": {
    "id": "merchant-1",
    "name": "TechStore",
    "wallet": "GMER...ABC"
  },
  "amount": 500,
  "loanAmount": 400,
  "guarantee": 100,
  "interestRate": 8,
  "totalRepayment": 432,
  "remainingBalance": 324,
  "status": "active",
  "payments": [
    {
      "amount": 108,
      "timestamp": "2026-02-13T10:00:00.000Z",
      "txHash": "abc123..."
    }
  ],
  "schedule": [...],
  "createdAt": "2026-02-13T10:00:00.000Z"
}
```

---

## Phase 6: Transactions

### POST /transactions/submit

Submit signed transaction to Stellar network.

**Status**: 🔴 Not Implemented (API-14)

**Authentication**: Required

**Request**:
```json
{
  "xdr": "AAAAAgAAAAC..."
}
```

**Response** (200 OK):
```json
{
  "hash": "abc123...",
  "status": "pending",
  "submittedAt": "2026-02-13T10:00:00.000Z"
}
```

**Errors**:
- `400`: Invalid XDR format
- `402`: Insufficient funds
- `500`: Stellar network error

---

### GET /transactions/:hash

Get transaction status.

**Status**: 🔴 Not Implemented (API-15)

**Authentication**: Required

**Response** (200 OK):
```json
{
  "hash": "abc123...",
  "status": "success",
  "result": {
    "ledger": 12345678,
    "timestamp": "2026-02-13T10:00:30.000Z"
  },
  "submittedAt": "2026-02-13T10:00:00.000Z"
}
```

**Possible statuses**: `pending`, `success`, `failed`

---

## Phase 7: Liquidity Pool

### GET /liquidity/overview

Get liquidity pool metrics.

**Status**: 🔴 Not Implemented (API-16)

**Authentication**: Optional

**Response** (200 OK):
```json
{
  "totalLiquidity": 1000000,
  "availableLiquidity": 300000,
  "loanedAmount": 700000,
  "utilization": 0.7,
  "apy": 8.5,
  "totalProviders": 42
}
```

---

### GET /liquidity/position

Get authenticated user's LP position.

**Status**: 🔴 Not Implemented (API-17)

**Authentication**: Required

**Response** (200 OK):
```json
{
  "wallet": "GABC...XYZ",
  "shares": 1000,
  "shareValue": 1.08,
  "currentValue": 1080,
  "depositedAmount": 1000,
  "gains": 80,
  "apy": 8.5,
  "depositedAt": "2026-01-13T10:00:00.000Z"
}
```

---

### POST /liquidity/deposit

Deposit funds to liquidity pool (returns unsigned XDR).

**Status**: 🔴 Not Implemented (API-18)

**Authentication**: Required

**Request**:
```json
{
  "amount": 1000
}
```

**Response** (200 OK):
```json
{
  "xdr": "AAAAAgAAAAC...",
  "amount": 1000,
  "expectedShares": 925,
  "currentShareValue": 1.08,
  "description": "Deposit $1000 to liquidity pool"
}
```

---

### POST /liquidity/withdraw

Withdraw funds from liquidity pool (returns unsigned XDR).

**Status**: 🔴 Not Implemented (API-19)

**Authentication**: Required

**Request**:
```json
{
  "shares": 500
}
```

**Response** (200 OK):
```json
{
  "xdr": "AAAAAgAAAAC...",
  "shares": 500,
  "expectedAmount": 540,
  "currentShareValue": 1.08,
  "description": "Withdraw 500 shares from liquidity pool"
}
```

**Errors**:
- `400`: Insufficient shares
- `402`: Pool has insufficient available liquidity

---

## Phase 9: Notifications

### GET /notifications

List user notifications.

**Status**: 🔴 Not Implemented (API-23)

**Authentication**: Required

**Query Parameters**:
- `unread` (boolean, optional): Filter unread notifications
- `limit` (number, default: 20)
- `offset` (number, default: 0)

**Response** (200 OK):
```json
{
  "notifications": [
    {
      "id": "notif-1",
      "type": "loan_reminder",
      "title": "Payment Due Soon",
      "message": "Your loan payment of $108 is due in 3 days",
      "isRead": false,
      "createdAt": "2026-02-10T10:00:00.000Z",
      "data": {
        "loanId": "loan-123",
        "amount": 108
      }
    }
  ],
  "total": 15,
  "unreadCount": 5,
  "limit": 20,
  "offset": 0
}
```

---

### PATCH /notifications/:id/read

Mark notification as read.

**Status**: 🔴 Not Implemented (API-24)

**Authentication**: Required

**Response** (200 OK):
```json
{
  "success": true
}
```

---

### PATCH /notifications/read-all

Mark all notifications as read.

**Status**: 🔴 Not Implemented (API-24)

**Authentication**: Required

**Response** (200 OK):
```json
{
  "success": true,
  "updatedCount": 5
}
```

---

## Common Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "amount",
      "message": "Amount must be greater than 0"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Resource not found"
}
```

### 429 Too Many Requests
```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded. Try again in 60 seconds"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Unexpected error occurred"
}
```

---

## Rate Limits

- **Authenticated requests**: 100 requests per minute
- **Public endpoints**: 20 requests per minute

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1644753600
```

---

## Pagination

Endpoints that return lists support pagination:

**Query Parameters**:
- `limit`: Items per page (max 100, default 20)
- `offset`: Number of items to skip (default 0)

**Response includes**:
```json
{
  "data": [...],
  "total": 150,
  "limit": 20,
  "offset": 40
}
```

---

## Related Documentation

- [ROADMAP.md](../../ROADMAP.md) - Implementation status
- [Response Standards](../development/response-standards.md)
- [Error Handling](../development/error-handling.md)

---

*Last Updated: 2026-02-13*
