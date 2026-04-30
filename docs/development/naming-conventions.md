# Naming Conventions

## Files and Folders

- **kebab-case** for all files and folders
- Examples: `user-service.ts`, `auth-controller.ts`, `loan-repository.ts`

## Classes

- **PascalCase** for classes
- Descriptive suffix: `Service`, `Controller`, `Module`, `Guard`, `Filter`
- Examples: `UserService`, `AuthController`, `JwtAuthGuard`

## Interfaces and Types

- **PascalCase** with optional `I` prefix for interfaces
- Examples: `User`, `CreateLoanDto`, `ILoanRepository`

## Variables and Functions

- **camelCase** for variables and functions
- Examples: `getUserById`, `loanAmount`, `isValidSignature`

## Constants

- **UPPER_SNAKE_CASE** for constants
- Examples: `MAX_LOAN_AMOUNT`, `DEFAULT_INTEREST_RATE`

## NestJS Modules

- Module name in **PascalCase** with `Module` suffix
- Folder in **kebab-case**
- Example: `src/modules/auth/` → `AuthModule`

## DTOs

- **PascalCase** with `Dto` suffix
- Request: `CreateLoanDto`, `UpdateUserDto`
- Response: `LoanResponseDto`, `UserResponseDto`

## Guards

- **PascalCase** with `Guard` suffix
- Example: `JwtAuthGuard`, `WalletSignatureGuard`

## Filters

- **PascalCase** with `Filter` suffix
- Example: `HttpExceptionFilter`, `ValidationExceptionFilter`
