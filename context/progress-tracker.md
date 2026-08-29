# Progress Tracker — StepFi-API

Format: date, commit hash, what changed, why.
Update this file in every PR that changes functionality (not needed for
pure chore/docs commits). Direct pushes to main must also be logged here.

---

## 2026-08-28

- Fixed TOCTOU nonce reuse in `AuthService.verifySignature()` (src/modules/auth/auth.service.ts:111):
  - **Atomic nonce consumption** — replaced `SELECT → verify → UPDATE` with atomic
    conditional claim `UPDATE nonces SET used_at = now() WHERE id = ? AND used_at IS NULL`
    executed **before** signature verification. Only the winner of the race gets
    `count === 1` / `data.length === 1`; losers get `count === 0` and are rejected
    with `AUTH_NONCE_NOT_FOUND`. This guarantees a given `(wallet, nonce)` can
    produce at most one successful verification ever, even under concurrent
    `POST /auth/verify` requests carrying the same stolen pair.
  - **Burn-on-failure tradeoff documented in code** — if verification fails
    (invalid signature, bad StrKey, or `expires_at` in the past) the nonce stays
    burned. The caller must request a fresh nonce; this converts replay attacks
    into DoS-on-self (one wasted challenge) versus unlimited session creation.
    Chosen over RPC/locking because a single conditional `UPDATE` is natively atomic
    in Postgres and fits the existing `SupabaseService.getServiceRoleClient()`
    pattern without a new migration.
  - **Per-wallet throttling on `POST /auth/verify`** — new `AuthWalletThrottlerGuard`
    (src/modules/auth/auth-throttler.guard.ts) keys `@nestjs/throttler` on
    `req.body.wallet` (fallback to `req.user.wallet` / IP) and is applied via
    `@UseGuards(AuthWalletThrottlerGuard)` alongside the existing global
    IP-based `ThrottlerGuard`. Route limit stays `5 req / 60 s` per wallet **and**
    per IP, preventing offline-style brute force of the SEP-0043 fallback space
    at network speed. `WalletThrottlerGuard` was also hardened to type-check
    wallet strings and accept `body.wallet` so the same infrastructure is reused.
  - **Tests** — extended `test/unit/modules/auth/auth.service.spec.ts` to prove
    atomicity: parallel double-verify → exactly one success, replay after success
    fails, replay after failure stays burned (`AUTH_SIGNATURE_INVALID` → `AUTH_NONCE_NOT_FOUND`),
    expired nonce rejected and stays burned, atomic race via `count === 0` rejected.
    Added `test/unit/modules/auth/auth-throttler.guard.spec.ts` for the wallet-keyed
    throttler and updated `auth.controller.spec.ts` to mock the guard. `npm run build`
    and `npm test` green (38 suites, 425 tests).

- Hardened `ApiKeyGuard` hot path (`src/auth/guards/api-key.guard.ts:29`):
  - **Cache key records by hash** — `CACHE_MANAGER` (Redis via `cache-manager` + `ioredis`, same pattern as `src/modules/liquidity/liquidity.service.ts:54` and `src/modules/transactions/transactions.service.ts:121`) stores `ApiKeyRecord` under `apikey:record:<keyHash>` (never the raw key) with `60s` TTL. Steady-state vendor traffic now causes ≤1 `SELECT` per TTL per key instead of 2 DB round-trips per request (lookup + unconditional `last_used_at` update). Negative lookups are not cached to avoid polluting the store; enumeration is handled by unified errors.
  - **Collapsed `last_used_at` writes** — cache-guarded dirty flag `apikey:last_used:<keyId>` with `300s` TTL ensures at-most-once-per-5-minutes-per-key DB `UPDATE`, eliminating 1:1 write amplification. Fire-and-forget `maybeUpdateLastUsed()` logs but never blocks the request.
  - **Normalized failure responses** — `API_KEY_INVALID`, `API_KEY_INACTIVE`, `API_KEY_EXPIRED`, and missing/malformed headers all map to a single `API_KEY_UNAUTHORIZED` (401) with `message: 'Invalid API key.'`. Server-side `Logger.warn` retains distinct reasons (`hash 8-char prefix`, `keyId`) for forensics, preventing enumeration of revoked vs expired vs nonexistent keys. `API_KEY_INSUFFICIENT_PERMISSIONS` (403) and `API_KEY_RATE_LIMITED` (429) remain distinct.
  - **Per-key sliding-window rate limiting** — cache-backed counter `apikey:rate:<keyId>` with `60s` window and `60` req limit (structured `429` `API_KEY_RATE_LIMITED` via `HttpException`). Wired through the repo's established `CACHE_MANAGER` guard pattern (not a new BullMQ queue), consistent with `ThrottlerGuard` per-wallet limits. Trips and resets with TTL are tested.
  - **Revocation invalidation** — `VendorsService.revokeApiKey()` (`src/modules/vendors/vendors.service.ts:636`) now selects `key_hash` alongside `id`, performs the `is_active=false` update, then `await cacheManager.del` for `apikey:record:<hash>`, `apikey:rate:<keyId>`, and `apikey:last_used:<keyId>`, guaranteeing visibility within one TTL. `VendorsService` now injects `CACHE_MANAGER` (`@Inject(CACHE_MANAGER)`) and `src/app.module.ts:13` registers a global `CacheModule` (`isGlobal: true`) via `getRedisConfig` so `ApiKeyGuard` and `VendorsService` share the same Redis/in-memory store.
  - **Tests** — rewrote `test/unit/modules/auth/api-key.guard.spec.ts:7` to assert cache hit avoids DB (mock `select` call counts and `never store full keys`), revocation invalidation (manual `del` then DB re-check), rate-limit trips (`60` → `429`) and resets after TTL, and enumeration uniformity (missing/invalid/inactive/expired all `API_KEY_UNAUTHORIZED`). Updated `test/unit/modules/vendors/vendors.service.spec.ts:14` to provide `CACHE_MANAGER` mock and verify `revokeApiKey` deletes the three cache keys and tolerates cache failures. `npm run build` and `npm test` green (38 suites, 434 tests).

---

## 2026-08-27

- Closed the audit gaps on `POST /transactions/submit` (#117):
  - **Fail-closed contract allowlist** — the contract ID for the declared
    type must be configured and the XDR must target it. Function-name-only
    matching was removed: an unset contract ID now rejects with
    `TRANSACTION_CONTRACT_NOT_CONFIGURED`, and an invocation whose target
    contract cannot be determined from the XDR rejects with
    `TRANSACTION_TYPE_MISMATCH` instead of silently skipping the check.
  - **No stale pending rows on submission failure** — when Horizon rejects
    the transaction (or submission fails unexpectedly), the persisted record
    is marked `failed` with the mapped error message and `completed_at`, so
    the row no longer lingers as `pending` attributable to the submitting
    wallet. Transient network unavailability (503) leaves the row `pending`
    for the status checker to reconcile, since the transaction may still be
    in flight.
  - Resolved the committed merge-conflict markers in this file (stale
    StepFi-Contracts content from the wrong repo removed; StepFi-API history
    retained).

## 2026-08-26

- Fixed registration race conditions in `AuthService.register()` by eliminating application-side pre-checks (`findByWallet`, `checkUsernameExists`) and relying directly on DB-level UNIQUE constraints (`users.wallet_address`, `users.username`).
- Added idempotent migration `20260826130000_ensure_users_unique_constraints.sql` to ensure unique indexes exist on `users.wallet_address` and `users.username`.
- Updated `UsersRepository.createProfile()` to catch PostgreSQL unique constraint violation error `23505` and map to structured 409 `ConflictException` (`AUTH_WALLET_EXISTS`, `AUTH_USERNAME_TAKEN`).
- Added cleanup handlers (`deleteAvatar`, `deleteUserById`) in `AuthService.register()` and `UsersRepository` to ensure failed registrations do not leave orphaned avatar files or partial user records.

## 2026-08-25

- Secured `POST /transactions/submit` (#117):
  - **Source binding** — the authenticated wallet must be the transaction
    source account (or the inner source for fee-bump transactions), or must
    appear as an authorized address in the Soroban invocation auth. Third-party
    XDR where the wallet is neither source nor authorizer is rejected with
    `TRANSACTION_SOURCE_MISMATCH`. (Deposit/withdraw/repay/vendor XDRs built
    by this API use a random source account and authorize via Soroban auth, so
    the auth check keeps those flows working.)
  - **Operation allowlist per type** — every operation must be a Soroban
    `invokeHostFunction` whose function name matches the declared type
    (`create_loan`, `repay_loan`/`repay_installment`, `deposit`, `withdraw`,
    `approve_vendor`, `suspend_vendor`) and must target the contract owned by
    that flow. Rejections use `TRANSACTION_TYPE_MISMATCH` /
    `TRANSACTION_OPERATION_NOT_ALLOWED`.
  - **Idempotency** — migration
    `20260825000001_add_unique_transaction_hash.sql` adds partial unique
    indexes on `transaction_hash` and `hash` (with pre-existing row dedupe);
    the service checks for an existing record before submitting and returns it
    (`duplicate: true`) instead of re-submitting, with the unique-constraint
    violation as the concurrency backstop.
  - **Rate limits** — `WalletThrottlerGuard` keys `@nestjs/throttler` on the
    authenticated wallet; the submit route is limited to 10 req / 60 s per
    wallet AND per IP (global guard), matching the auth-endpoint pattern.
  - **Persistence-first** — the local record is written (await) before the
    Horizon submission, so persistence failures surface as
    `TRANSACTION_PERSISTENCE_FAILED` instead of being silently dropped, and
    the transaction hash is always known to the status checker / indexer.
  - Updated `SubmitTransactionResponseDto` (`status` may reflect the recorded
    status, plus `duplicate` flag), controller Swagger, and unit tests covering
    every rejection branch plus the happy path.

## 2026-08-24

- **Session families + refresh-token replay detection** (`sessions.family_id`
  migration, `fam` claim in refresh JWTs). Replaying an already-rotated
  refresh token now revokes every session in the family and writes a
  `auth.refresh_token_reuse` audit log entry — previously the first
  presenter of a stolen token won silently. Legacy tokens without a `fam`
  claim keep the old `AUTH_SESSION_NOT_FOUND` response.
- **Blocked-user enforcement on every request**: new
  `UserStatusService` (in-memory TTL cache) consulted by `JwtStrategy`.
  Documented staleness bound: **30 seconds** — a blocked wallet loses API
  access within ~30s of being blocked instead of retaining access until its
  access token expires (up to 15 minutes). Cache is per-instance and fails
  open on DB errors to avoid locking out all users during a DB blip.
- **Session cleanup cron** (`src/jobs/session-cleanup/`, hourly,
  mirrors nonce-cleanup): deletes only rows with `expires_at` older than
  1 hour; sessions no longer accumulate forever.
- Tests: refresh-family rotation, replay → family-wide revocation + audit
  event, blocked-user denial within TTL bound, cache expiry re-query,
  cleanup job deletes-only-expired.

## 2026-07-23

- Added GitHub Actions health check workflow (`health-check.yml`) to ping the Render API every 6 hours to prevent the free tier instance from sleeping. Auto-creates or comments on issues with the `incident` label if the ping fails, preventing silent outages.
- Documented the ping URL and incident label in README.

## 2026-07-19

- Wired `LiquidityContractClient` (restored under `src/blockchain/contracts/liquidity-contract.client.ts`) into `LiquidityService` constructor.
- Read contract ID from `ConfigService` under `LIQUIDITY_POOL_CONTRACT_ID`.
- Replaced placeholder deposit/withdraw XDR strings in `LiquidityService` with real transaction simulation and assembly (`buildUnsignedXdr`).
- Mapped smart contract simulation errors (e.g., custom error codes like 100-104) to HTTP 400 (`BadRequestException`) with typed error codes.
- Added E2E test `test/e2e/liquidity.e2e-spec.ts` asserting transaction XDR parsing and contract simulation error mapping.
- Updated existing `test/e2e/modules/liquidity/liquidity-flow.e2e-spec.ts` to mock the new `LiquidityContractClient` structure.
- Updated `test/unit/modules/liquidity/liquidity.service.spec.ts` unit tests.

## 2026-07-18

- Added scheduled state reconciliation across indexed on-chain loan,
  liquidity, reputation, and transaction state. The idempotent Cron job
  resolves provisional loan IDs, repairs stale database state, backfills
  missed transaction records, marks orphaned pending transactions, exports
  drift metrics, and logs a structured report without making on-chain writes.
  Cron is used instead of BullMQ per the API's post-Upstash architecture.

## 2026-07-16

- Added wallet-bound user roles (sponsor/vendor/mentor): `role` column
  migration, one-time `POST /users/me/role` (409 once set), role claim
  in JWT, `RolesGuard` on vendor/liquidity endpoints (direct push,
  parallel session)
- Enforced `@typescript-eslint/no-explicit-any` at error via new
  `.eslintrc.js` (repo previously had a lint script but no ESLint
  config); replaced all 32 explicit `any` usages in src/ with real
  types (direct push, documented here per new git standards)
- Fixed liquidity overview endpoint to expose `lockedLiquidity`,
  `availableLiquidity`, `totalShares`, `sharePrice` — the web sponsor
  dashboard needed the locked vs available breakdown (commit 3961123)
- Fixed indexer cursor not persisting after the BullMQ→Cron migration
  (commit c74a05f)
- Removed BullMQ entirely; all jobs now use `@Cron` or `setInterval`
  (commit c9cfbd0)
- Migrated to a new Upstash Redis database after hitting the 500k
  free-tier request limit (ops change, no commit)

## 2026-07-15

- Replaced BullMQ polling jobs with `@Cron` and `setInterval`, cutting
  Redis usage by ~90% (commit d908c52)

## 2026-07-02

- Added Supabase keep-alive cron job to prevent free-tier project
  pausing (commit 0ff9928)
- Indexer: self-healing reset of stale ledger checkpoint (commit b7f418c)
  and jump-to-recent-ledger instead of incrementing by 1 (commit 4130db2)
- Fixed learner profile migration — quoted the reserved word
  `current_role` (commit 422992b)
- Resolved npm audit vulnerabilities (commit 1bf7372)
- Repo hygiene: PR template + CODEOWNERS (b2bdfa4), issue template with
  test requirements (78b76bb)

## 2026-06-27

- API Key authentication system for vendor service-to-service
  integration (#60, commit 7524888)
- Extended learner onboarding profile endpoint — richer profile fields,
  completion tracking (#59, commit be6ac8b)

## 2026-06-21

- Two-step repayment flow: `buildRepaymentXdr()` + submit endpoint so
  wallets sign server-built XDR (#51, commit 4224bb6)

## 2026-06-19

- Integrated Sentry for error tracking; fixed MetricsModule dependency
  injection startup error (#55, commit 58848c1)
- Added `GET /api/v1/vouching/requests` for incoming vouch requests
  (#54, commit cb60433)
- End-to-end loan lifecycle test with in-memory mock infrastructure
  (#52, commit 5a4efa0)

## 2026-06-18

- Audit log for admin operations (#49, commit 760d459)
- SponsorsService: `getPool()`, `buildDepositXdr()`, `buildWithdrawXdr()`
  with unit tests (#48, commit 1793032)

---

> Note (2026-07-16): this file previously contained StepFi-Contracts
> content copied from the wrong repo. Replaced with real StepFi-API
> history backfilled from `git log`. Entries older than 2026-06-18 are
> in git history but were never tracked here.
