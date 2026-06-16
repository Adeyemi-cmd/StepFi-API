# Progress Tracker — StepFi-Contracts

Update this file after every completed contract change, fix, or architectural decision. Progress state must reflect the actual deployed and tested state — not the intended state.

---

## Current Phase

**Phase 1 — Contract Infrastructure & Core Fixes**

## Current Goal

EAS build for Expo preview → then landing page → then GitHub issues → then Drips Wave

---

## Completed

### Workspace Cleanup
- Removed dead code: `lp-contract` (superseded by `liquidity-pool-contract`)
- Removed empty placeholder: `adapter-trustless-contract`
- Updated `Cargo.toml` workspace members to reflect 5 active contracts
- Removed `[profile]` sections from individual contract `Cargo.toml` files (profiles belong in workspace root only)

### Renaming
- Renamed `merchant-registry-contract` → `vendor-registry-contract`
- Updated all Rust source references: `merchant_registry_contract` → `vendor_registry_contract`
- Updated all struct names: `MerchantRegistry*` → `VendorRegistry*`
- Updated `Cargo.toml` dependency paths in `creditline-contract`

### Critical Fixes
- Added TTL constants (`PERSISTENT_TTL_THRESHOLD`, `PERSISTENT_TTL_EXTEND_TO`) to `creditline-contract/src/storage.rs`
- Added `upgrade()` function to all 5 contracts: reputation, creditline, liquidity-pool, vendor-registry, parameters
- All 5 contracts build cleanly: `cargo build` passes with zero errors (3 minor unused constant warnings — acceptable)

### Deployment
- Created `scripts/deploy-testnet.sh` — full deployment script covering all 5 contracts in correct dependency order
- Script outputs contract IDs and saves to `.env.contracts`
- StepFi-API deployed on Render ✅
- Supabase project created, 24 migrations applied ✅
- Upstash Redis connected ✅
- Swagger docs live ✅

### Documentation
- `README.md` fully rewritten as StepFi-Contracts

### CI Pipeline
- Created `.github/workflows/ci.yml` — runs on push/PR to `main`
- Steps: checkout → setup Node 20 → `npm ci` → `npm run build` → `npm test`
- `node_modules` cached via `actions/cache@v4` keyed on `package-lock.json` hash
- CI status badge added to `README.md` pointing at the workflow

---

## In Progress

- None currently.

---

## Next Up (In Order)

1. **LoanType enum** — Add `LoanType::LearnerInstallment` variant to `creditline-contract/src/types.rs`
2. **Per-installment tracking** — Add `paid: bool` and `paid_at: u64` fields to `RepaymentInstallment` struct
3. **repay_installment()** — New function targeting a specific installment by index (instead of just reducing remaining balance)
4. **Learner grace period** — Make `grace_period_seconds` per-loan (not just global via parameters)
5. **Vouching contract** — New `vouching-contract` crate: `vouch()`, `revoke_vouch()`, `get_vouches()`, `get_vouch_count()`
6. **Reputation rules** — Update `creditline-contract` to call different reputation adjustments for `LoanType::LearnerInstallment`
7. **Testnet deployment** — Deploy all contracts, capture IDs, add to StepFi-API `.env`
8. **End-to-end validation** — Verify loan lifecycle on testnet via Stellar CLI

---

## Open Questions

- What token is used for loans — native XLM or a USDC anchor? (Affects token contract address in `initialize()`)
- Should the vouching contract be a standalone crate or logic added to `creditline-contract`? (Leaning toward standalone for modularity)
- What is the correct `grace_period_seconds` for learner installment loans? (Longer than standard BNPL — possibly 7-14 days per installment)
- Should sponsor pool deposits go through `liquidity-pool-contract` or a new `sponsor-pool-contract`?

---

## Architecture Decisions

- **5 contracts, not 6** — `lp-contract` was dead code, removed. `liquidity-pool-contract` is the canonical LP implementation.
- **Vendor over Merchant** — Renamed to reflect StepFi's learning-focused domain.
- **TTL approach** — Using 60-day threshold / 120-day extension constants. Off-chain indexer is responsible for bumping TTL on active loan entries.
- **Upgrade pattern** — All contracts have `upgrade()` gated by admin `require_auth()`. Admin address is set at `initialize()` and transferable via `set_admin()`.
- **Loan sharding** — 32 shards (`loan_id % 32`) in creditline-contract to distribute persistent storage keys and avoid hot-key contention.
- **Reentrancy** — Boolean `LOCKED` flag in instance storage. Cheaper than mutex, sufficient for Soroban's single-threaded execution model.

---

## Contract Deployment Status

| Contract | Testnet Deployed | Contract ID | Last Deployed |
|---|---|---|---|
| `reputation-contract` | ❌ No | — | — |
| `parameters-contract` | ❌ No | — | — |
| `vendor-registry-contract` | ❌ No | — | — |
| `liquidity-pool-contract` | ❌ No | — | — |
| `creditline-contract` | ❌ No | — | — |

> Update this table after running `scripts/deploy-testnet.sh`

---

## Session Notes

- Always run `cargo build` after any contract change before committing.
- Always run `cargo test` before marking any contract feature complete.
- Never modify storage key structures of a contract that has been deployed — it breaks existing data. Use a migration pattern or deploy a new contract.
- The `creditline-contract` depends on all other contracts — it must be initialized last.
- Do not add new workspace members to `Cargo.toml` without creating the full contract file structure first.
