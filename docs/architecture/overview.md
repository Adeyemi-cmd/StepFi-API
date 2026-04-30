# Project Architecture

## Main Layers

```
Kotlin Mobile App
        ↓
StepFi API (NestJS + Fastify)
        ↓
Soroban Smart Contracts
        ↓
Stellar Network
        ↓
Supabase (UX Index + Metadata)
```

## Layer Structure

### 1. Presentation Layer (Controllers)
- `src/modules/*/controllers/`
- Handles HTTP requests
- Validates input with DTOs
- Delegates logic to Services

### 2. Business Logic Layer (Services)
- `src/modules/*/services/`
- Contains all business logic
- Orchestrates calls to repositories and blockchain
- No presentation logic

### 3. Data Access Layer (Repositories)
- `src/database/repositories/`
- Data access abstraction
- Supabase interaction

### 4. Blockchain Layer
- `src/blockchain/`
  - `stellar/`: Stellar client (accounts, fees, queries)
  - `soroban/`: Soroban client (simulation, invocations)
  - `contracts/`: Contract clients (TypeScript wrappers to interact with on-chain contracts)
- Build unsigned XDR transactions
- Read on-chain state
- **Note**: Does NOT contain smart contracts (those are on-chain), only clients to interact with them

### 5. Infrastructure Layer
- `src/config/`: Configuration
- `src/common/`: Shared utilities
- `src/jobs/`: Background jobs

## Principles

- **On-chain is truth**: Blockchain is the source of truth
- **Replaceable backend**: Modular architecture
- **Separation of concerns**: Each layer has a clear purpose
- **Dependency Injection**: NestJS handles dependency injection
