# Dependencies Audit — StepFi-API

Last audited: 2026-05-05
Auditor: maintainer
Next scheduled audit: 2026-08-05 (quarterly)

Run audit: `npm audit`
Run list: `npm list --depth=0`

---

## Audit Summary

| Total | Critical | High | Moderate | Low |
|---|---|---|---|---|
| 42 vulnerabilities | 2 | 12 | 22 | 6 |

**Action required before mainnet:** All critical and high vulnerabilities must be resolved.
**Immediate action required:** `@fastify/middie` (critical) and `handlebars` (critical).

---

## Critical Vulnerabilities 🔴

### @fastify/middie (via @nestjs/platform-fastify)
- **Severity:** Critical
- **Issues:** Path bypass, middleware authentication bypass, deprecated option bypass
- **Fix:** `npm audit fix --force` → upgrades `@nestjs/platform-fastify` to v11 (breaking change)
- **Action:** Plan NestJS v11 migration. Do not deploy to mainnet without this fix.
- **CVEs:** GHSA-cxrg-g7r8-w69p, GHSA-8p85-9qpw-fwgw, GHSA-72c6-fx6q-fr5w, GHSA-v9ww-2j6r-98q6

### handlebars
- **Severity:** Critical
- **Issues:** JavaScript injection via AST type confusion, prototype pollution leading to XSS, property access validation bypass, DoS via malformed decorator syntax
- **Fix:** `npm audit fix` (non-breaking)
- **Action:** Run `npm audit fix` immediately — this fix is safe.
- **CVEs:** GHSA-3mfm-83xf-c92r, GHSA-2w6w-674q-4c4q, GHSA-2qvq-rjwj-gvw9, GHSA-7rx3-28cr-v5wh

---

## High Vulnerabilities 🟠

### axios (1.0.0 - 1.15.1)
- **Severity:** High
- **Issues:** DoS via prototype pollution, SSRF via NO_PROXY bypass, credential injection, request hijacking, CRLF injection, null byte injection, prototype pollution gadgets
- **Fix:** `npm audit fix` (non-breaking)
- **Action:** Run `npm audit fix` immediately.
- **Note:** axios is a transitive dependency — not directly in package.json. Fix updates it automatically.

### fastify (<=5.8.2)
- **Severity:** High
- **Issues:** DoS via unbounded memory allocation in sendWebStream, body validation bypass via tab character in Content-Type, request.protocol/host spoofing
- **Fix:** `npm audit fix --force` → upgrades to fastify v5 (breaking change)
- **Action:** Part of the NestJS v11 migration plan.

### lodash (<=4.17.23)
- **Severity:** High
- **Issues:** Prototype pollution in `_.unset` and `_.omit`, code injection via `_.template`
- **Fix:** `npm audit fix --force` → upgrades `@nestjs/swagger` to v11 (breaking change)
- **Action:** Part of NestJS v11 migration plan.

### multer (<=2.1.0)
- **Severity:** High
- **Issues:** DoS via incomplete cleanup, resource exhaustion, uncontrolled recursion
- **Fix:** `npm audit fix --force` → upgrades `@nestjs/platform-express` to v11 (breaking change)
- **Action:** Part of NestJS v11 migration plan. multer is used for avatar uploads in auth module.

### minimatch (multiple versions)
- **Severity:** High
- **Issues:** ReDoS via repeated wildcards, combinatorial backtracking, nested extglobs
- **Fix:** `npm audit fix` (non-breaking for most instances)
- **Action:** Run `npm audit fix`.

### glob (10.2.0 - 10.4.5)
- **Severity:** High
- **Issues:** Command injection via -c/--cmd flag
- **Fix:** `npm audit fix --force` → upgrades `@nestjs/cli` to v11 (breaking change — devDependency only)
- **Action:** Low risk — devDependency only, not in production bundle.

### picomatch (multiple versions)
- **Severity:** High
- **Issues:** Method injection in POSIX character classes, ReDoS via extglob quantifiers
- **Fix:** `npm audit fix --force` → upgrades `@nestjs/cli` (devDependency)
- **Action:** Low risk — devDependency only.

### flatted
- **Severity:** High
- **Issues:** Unbounded recursion DoS in parse() revive phase, prototype pollution
- **Fix:** `npm audit fix` (non-breaking)
- **Action:** Run `npm audit fix`.

### path-to-regexp (8.0.0 - 8.3.0)
- **Severity:** High
- **Issues:** DoS via sequential optional groups, ReDoS via multiple wildcards
- **Fix:** `npm audit fix` (non-breaking)
- **Action:** Run `npm audit fix`.

---

## Moderate Vulnerabilities 🟡

### @nestjs/core (<=11.1.17)
- **Issues:** Injection vulnerability, depends on vulnerable platform-express
- **Fix:** Part of NestJS v11 migration

### ajv (multiple ranges)
- **Issues:** ReDoS when using `$data` option
- **Fix:** `npm audit fix --force` → upgrades `@nestjs/cli` (devDependency)
- **Action:** Low risk — devDependency only.

### js-yaml (4.0.0 - 4.1.0)
- **Issues:** Prototype pollution in merge (<<)
- **Fix:** `npm audit fix --force` → upgrades `@nestjs/swagger` to v11

### uuid (<14.0.0) via bullmq
- **Issues:** Missing buffer bounds check in v3/v5/v6
- **Fix:** `npm audit fix` (non-breaking)
- **Action:** Run `npm audit fix`.

### follow-redirects (<=1.15.11)
- **Issues:** Leaks custom auth headers to cross-domain redirect targets
- **Fix:** `npm audit fix` (non-breaking)
- **Action:** Run `npm audit fix`.

### file-type (13.0.0 - 21.3.1)
- **Issues:** Infinite loop in ASF parser, ZIP decompression bomb DoS
- **Fix:** Resolved by upgrading `@nestjs/common` (part of NestJS v11 migration)

### brace-expansion, qs, diff, hono, @hono/node-server
- **Issues:** Various moderate ReDoS and bypass vulnerabilities
- **Fix:** `npm audit fix` (non-breaking)

---

## Immediate Action Plan

### Step 1 — Safe fixes (run now, no breaking changes)
```bash
npm audit fix
```
Fixes: axios, handlebars, flatted, path-to-regexp, minimatch (some), brace-expansion, qs, diff, hono, follow-redirects, uuid, file-type

### Step 2 — NestJS v11 migration (plan for next sprint)
This single migration resolves the majority of remaining vulnerabilities:
- `@fastify/middie` (critical)
- `fastify` (high)
- `lodash` via `@nestjs/swagger` (high)
- `multer` (high)
- `@nestjs/core` injection (moderate)
- `js-yaml` (moderate)

Migration scope:
```bash
npm install @nestjs/common@^11 @nestjs/core@^11 @nestjs/platform-fastify@^11 \
  @nestjs/swagger@^11 @nestjs/bullmq@^11 @nestjs/throttler@^11 \
  @nestjs/jwt@^11 @nestjs/passport@^11 @nestjs/config@^11
```

### Step 3 — Migrate stellar-sdk (deprecation warning)
```bash
npm uninstall stellar-sdk
npm install @stellar/stellar-sdk
```
Update all imports from `stellar-sdk` to `@stellar/stellar-sdk`.

---

## Deprecated Packages ⚠️

| Package | Status | Action |
|---|---|---|
| `stellar-sdk@11.3.0` | Deprecated — moved to `@stellar/stellar-sdk` | Migrate before mainnet |
| `supertest@6.3.4` | Deprecated — upgrade to v7.1.3+ | `npm install supertest@latest --save-dev` |
| `eslint@8.57.1` | No longer supported | Upgrade to v9 (breaking — config format changed) |

---

## Production Dependencies

| Package | Version | Purpose | Status |
|---|---|---|---|
| `@modelcontextprotocol/sdk` | 1.28.0 | MCP server for AI agent tooling | ✅ Safe |
| `@nestjs/bullmq` | 10.2.3 | BullMQ integration for NestJS | ⚠️ Upgrade to v11 |
| `@nestjs/cache-manager` | 3.1.0 | Redis cache module | ✅ Safe |
| `@nestjs/common` | 10.4.20 | NestJS common utilities | ⚠️ Upgrade to v11 |
| `@nestjs/config` | 3.3.0 | Environment config module | ⚠️ Upgrade to v11 |
| `@nestjs/core` | 10.4.20 | NestJS core framework | ⚠️ Upgrade to v11 |
| `@nestjs/jwt` | 10.2.0 | JWT auth module | ⚠️ Upgrade to v11 |
| `@nestjs/passport` | 10.0.3 | Passport auth module | ⚠️ Upgrade to v11 |
| `@nestjs/platform-fastify` | 10.4.20 | Fastify HTTP adapter | 🔴 Critical — upgrade to v11 |
| `@nestjs/swagger` | 7.4.2 | Swagger/OpenAPI docs | ⚠️ Upgrade to v11 |
| `@nestjs/throttler` | 5.2.0 | Rate limiting module | ⚠️ Upgrade to v11 |
| `@sentry/nestjs` | 8.55.0 | Error tracking | ✅ Safe |
| `@supabase/supabase-js` | 2.89.0 | Supabase client | ✅ Safe |
| `bullmq` | 5.66.4 | Background job queues | ⚠️ uuid transitive fix |
| `cache-manager` | 7.2.8 | Cache abstraction layer | ✅ Safe |
| `cache-manager-redis-store` | 3.0.1 | Redis store for cache-manager | ✅ Safe |
| `class-transformer` | 0.5.1 | Object transformation | ✅ Safe |
| `class-validator` | 0.14.3 | Input validation decorators | ✅ Safe |
| `fastify` | 4.29.1 | HTTP server | 🟠 High — upgrade to v5 |
| `helmet` | 7.2.0 | Security headers middleware | ✅ Safe |
| `ioredis` | 5.8.2 | Redis client | ✅ Safe |
| `multer` | 2.1.1 | File upload handling | 🟠 High — upgrade |
| `passport` | 0.7.0 | Auth middleware | ✅ Safe |
| `passport-jwt` | 4.0.1 | JWT Passport strategy | ✅ Safe |
| `pino` | 8.21.0 | Structured logging | ✅ Safe |
| `pino-pretty` | 11.3.0 | Pretty-print Pino logs | ✅ Safe |
| `reflect-metadata` | 0.2.2 | Decorator metadata | ✅ Safe |
| `rxjs` | 7.8.2 | Reactive extensions | ✅ Safe |
| `stellar-sdk` | 11.3.0 | Stellar blockchain client | ⚠️ Deprecated — migrate |
| `zod` | 3.25.76 | Schema validation | ✅ Safe |

---

## Dev Dependencies

| Package | Version | Status | Notes |
|---|---|---|---|
| `@nestjs/cli` | 10.4.9 | ⚠️ Several transitive vulns | devOnly — low production risk |
| `@nestjs/testing` | 10.4.20 | ⚠️ Upgrade to v11 | devOnly |
| `@types/*` | various | ✅ Safe | Type definitions only |
| `eslint` | 8.57.1 | ⚠️ Deprecated | Upgrade to v9 |
| `jest` | 29.7.0 | ✅ Safe | — |
| `prettier` | 3.7.4 | ✅ Safe | — |
| `supertest` | 6.3.4 | ⚠️ Deprecated | Upgrade to v7 |
| `ts-jest` | 29.4.6 | ✅ Safe | — |
| `ts-node` | 10.9.2 | ✅ Safe | — |
| `typescript` | 5.9.3 | ✅ Safe | Latest stable |

---

## Rules for Adding New Dependencies

Before adding any new package to StepFi-API:

1. **Justify it** — explain in the PR why existing packages cannot solve the problem
2. **Check activity** — the package must have a commit within the last 12 months
3. **Check vulnerabilities** — run `npm audit` after installing and verify zero new issues
4. **Check downloads** — prefer packages with >100k weekly downloads (indicates community maintenance)
5. **Add to this file** — add the package to the Production or Dev Dependencies table on the same PR
6. **No packages with unresolved critical CVEs** — ever

---

## Quarterly Audit Schedule

| Date | Auditor | Critical | High | Action Taken |
|---|---|---|---|---|
| 2026-05-05 | @EmeditWeb | 2 | 12 | Documented — NestJS v11 migration planned |
| 2026-08-05 | — | — | — | Scheduled |
| 2026-11-05 | — | — | — | Scheduled |