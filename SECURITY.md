# Security Policy

## Overview

Security is a top priority for StepFi. This document outlines our security practices, how to report vulnerabilities, and guidelines for secure development.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

**Note**: We are currently in development (pre-1.0). Security updates will be applied to the main branch.

## Reporting a Vulnerability

**Please DO NOT open public issues for security vulnerabilities.**

If you discover a security vulnerability, please report it privately to:

- **Email**: security@stepfi.io *(to be set up)*
- **GitHub**: Use [GitHub Security Advisories](https://github.com/StepFi/StepFi-API/security/advisories/new)

### What to Include

When reporting a vulnerability, please provide:

1. **Description**: Clear description of the vulnerability
2. **Impact**: Potential impact and severity
3. **Reproduction Steps**: Step-by-step instructions to reproduce
4. **Proof of Concept**: Code snippet or example (if applicable)
5. **Suggested Fix**: Potential solution (optional)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Fix Timeline**: Based on severity
  - Critical: 24-48 hours
  - High: 1 week
  - Medium: 2-4 weeks
  - Low: Next release cycle

## Security Best Practices

### Authentication & Authorization

1. **Wallet-Based Authentication**
   - Signature verification using Stellar cryptography
   - Nonces expire after 5 minutes
   - JWTs expire after 15 minutes (access) / 7 days (refresh)
   - Refresh tokens are hashed before storage

2. **JWT Security**
   - Use strong secret keys (32+ characters, random)
   - Rotate JWT secrets periodically
   - Validate token expiration strictly
   - Never expose tokens in URLs or logs

3. **Access Control**
   - Implement Row Level Security (RLS) in Supabase
   - Users can only access their own data
   - Validate user ownership on every request

### Input Validation

1. **DTOs and Validation**
   - Use `class-validator` for all input validation
   - Sanitize user inputs before database storage
   - Validate Stellar addresses format
   - Validate numeric ranges and limits

2. **SQL Injection Prevention**
   - Use parameterized queries (ORM/query builder)
   - Never concatenate user input into SQL
   - Enable prepared statements

3. **XSS Prevention**
   - Sanitize HTML content if accepting rich text
   - Use Content Security Policy (CSP) headers
   - Encode output when rendering user data

### Blockchain Security

1. **Transaction Validation**
   - Validate XDR format before submission
   - Check transaction source matches authenticated user
   - Validate transaction sequence numbers
   - Implement transaction limits

2. **Private Key Management**
   - Never store private keys in the API
   - Users sign transactions client-side
   - API only handles unsigned/signed XDRs
   - No server-side signing

3. **Smart Contract Integration**
   - Validate contract responses
   - Handle contract errors gracefully
   - Implement retry logic with exponential backoff
   - Set transaction timeouts

### Data Protection

1. **Environment Variables**
   - Never commit `.env` files
   - Use secret management tools in production (AWS Secrets Manager, Vault)
   - Rotate secrets regularly
   - Minimum privilege principle for API keys

2. **Database Security**
   - Enable SSL/TLS for database connections
   - Use Supabase RLS policies
   - Encrypt sensitive data at rest
   - Regular backups with encryption

3. **API Security**
   - Enable CORS with whitelist
   - Implement rate limiting (100 req/min)
   - Use HTTPS only in production
   - Set secure HTTP headers (Helmet)

### Error Handling

1. **Don't Expose Sensitive Information**
   - Never return stack traces to clients
   - Log detailed errors server-side only
   - Return generic error messages
   - Sanitize error messages

2. **Logging Security**
   - Never log sensitive data (tokens, keys, passwords)
   - Redact wallet addresses in logs if needed
   - Use structured logging
   - Implement log rotation

### Dependencies

1. **Dependency Management**
   - Run `npm audit` regularly
   - Update dependencies to patch vulnerabilities
   - Use `npm audit fix` carefully
   - Review changes before updating major versions

2. **Supply Chain Security**
   - Lock dependencies with `package-lock.json`
   - Verify package integrity
   - Use trusted registries only
   - Monitor for malicious packages

## Security Headers

The API implements these security headers:

```typescript
// Helmet configuration
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
})
```

## Rate Limiting

Implement rate limiting to prevent abuse:

```typescript
{
  ttl: 60,           // 60 seconds
  limit: 100,        // 100 requests
  blockDuration: 300 // Block for 5 minutes if exceeded
}
```

**Endpoints with stricter limits**:
- `/auth/nonce`: 10 requests/minute
- `/auth/verify`: 5 requests/minute
- `/transactions/submit`: 20 requests/minute

## OWASP Top 10 Mitigation

### A01: Broken Access Control
- ✅ Implement RLS in Supabase
- ✅ Validate user ownership on mutations
- ✅ Use JwtAuthGuard on protected endpoints

### A02: Cryptographic Failures
- ✅ Use HTTPS only in production
- ✅ Hash refresh tokens before storage
- ✅ Use secure random for nonces

### A03: Injection
- ✅ Use parameterized queries (ORM)
- ✅ Validate all inputs with DTOs
- ✅ Sanitize user inputs

### A04: Insecure Design
- ✅ Wallet-based authentication
- ✅ No password storage
- ✅ Client-side transaction signing

### A05: Security Misconfiguration
- ✅ Secure default configurations
- ✅ Disable unnecessary features
- ✅ Keep dependencies updated

### A06: Vulnerable Components
- ✅ Regular `npm audit`
- ✅ Automated dependency updates (Dependabot)
- ✅ Security-focused dependencies

### A07: Identification & Authentication Failures
- ✅ Short-lived JWTs
- ✅ Secure nonce generation
- ✅ Refresh token rotation

### A08: Software & Data Integrity Failures
- ✅ Lock dependencies
- ✅ Verify transaction signatures
- ✅ Validate blockchain data

### A09: Security Logging & Monitoring
- ✅ Structured logging
- ✅ Security event logging
- ✅ Error tracking (Sentry)

### A10: Server-Side Request Forgery (SSRF)
- ✅ Validate URLs before fetching
- ✅ Whitelist allowed domains
- ✅ Use trusted RPC endpoints only

## Deployment Security

### Production Checklist

- [ ] HTTPS enabled with valid certificate
- [ ] Environment variables set securely
- [ ] Database SSL/TLS enabled
- [ ] CORS whitelist configured
- [ ] Rate limiting enabled
- [ ] Helmet headers configured
- [ ] Error messages sanitized
- [ ] Logging configured (no sensitive data)
- [ ] Secrets rotated
- [ ] Dependency vulnerabilities resolved
- [ ] Security headers tested
- [ ] Monitoring and alerting enabled

### Infrastructure Security

1. **Network Security**
   - Use VPC/private networks
   - Firewall rules for database access
   - DDoS protection (Cloudflare, AWS Shield)

2. **Access Management**
   - Least privilege IAM policies
   - MFA for production access
   - Regular access audits

3. **Monitoring**
   - Log aggregation (CloudWatch, DataDog)
   - Security event alerts
   - Anomaly detection

## Incident Response

### In Case of Security Breach

1. **Contain**: Isolate affected systems
2. **Assess**: Determine scope and impact
3. **Notify**: Inform affected users if necessary
4. **Fix**: Deploy patch or mitigation
5. **Review**: Post-mortem and prevention

### Contact

For security-related questions:
- **Email**: security@stepfi.io
- **GitHub**: Security Advisories

## Compliance

### Data Privacy

- **GDPR**: User data handling compliant
- **Data Retention**: Clear policies documented
- **Right to Deletion**: User can delete account and data

### Blockchain Transparency

- All transactions are public on Stellar blockchain
- Users are informed about on-chain data persistence
- Wallet addresses are pseudonymous (not anonymous)

## Security Tools

### Recommended Tools

1. **Static Analysis**
   - ESLint with security plugin
   - SonarQube
   - Semgrep

2. **Dependency Scanning**
   - npm audit
   - Snyk
   - Dependabot

3. **Runtime Protection**
   - Helmet (HTTP headers)
   - express-rate-limit
   - express-validator

4. **Monitoring**
   - Sentry (error tracking)
   - DataDog (APM)
   - CloudWatch (logs)

## Security Testing

### Regular Testing

- **Unit Tests**: Validate input sanitization
- **Integration Tests**: Test authentication flows
- **E2E Tests**: Simulate attack scenarios
- **Penetration Testing**: Annual third-party audit (when production-ready)

### Test Coverage

Ensure security-critical code has 100% test coverage:
- Authentication service
- Authorization guards
- Input validation
- Signature verification

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Stellar Security Best Practices](https://developers.stellar.org/docs/learn/security-best-practices)
- [NestJS Security](https://docs.nestjs.com/security/authentication)
- [Supabase Security](https://supabase.com/docs/guides/auth/row-level-security)

---

*Last Updated: 2026-04-30*
