# StepFi Roadmap

> Step into your future, pay small small.

This roadmap outlines the development phases for StepFi — a decentralized learner BNPL protocol on Stellar. Each phase builds on the previous one, moving from core infrastructure to a fully featured learner financing ecosystem.

---

## Phase 1 — Core Infrastructure 🔧
*Goal: Get the API running end-to-end on testnet*

- [ ] CORS and Swagger setup in main.ts
- [ ] Supabase singleton client
- [ ] All database migrations complete
- [ ] Refresh token endpoint
- [ ] Real reputation contract client wired in
- [ ] Testnet deployment scripts for all Soroban contracts
- [ ] Contract TTL management (extend_ttl on all persistent storage)
- [ ] Contract upgrade mechanism
- [ ] Health check endpoint verified
- [ ] Environment variables fully documented

---

## Phase 2 — Auth & User Profiles 🔐
*Goal: Users can register, sign in, and manage their profile*

- [ ] Wallet-based registration flow (Ed25519 signature)
- [ ] JWT access + refresh token pair
- [ ] Nonce cleanup scheduled job
- [ ] Learner profile module (school, program, income type)
- [ ] Avatar upload via Supabase Storage
- [ ] Account blocking and status management
- [ ] User preferences (notifications, language, theme)

---

## Phase 3 — Reputation System ⭐
*Goal: On-chain reputation scores drive credit decisions*

- [ ] Reputation contract deployed and initialized on testnet
- [ ] Real-time score fetch via Soroban RPC
- [ ] Three-tier cache (Redis → Supabase → Blockchain)
- [ ] Score history indexed from Soroban events
- [ ] Learner-specific scoring rules (on-time payments, course completion)
- [ ] Reputation tiers: Starter → Bronze → Silver → Gold
- [ ] Score breakdown endpoint (what affects your score)

---

## Phase 4 — Vendor Registry 🏪
*Goal: Verified learning vendors available for financing*

- [ ] Vendor registry contract deployed
- [ ] Vendor types: School, Bootcamp, Electronics, Books, Subscriptions
- [ ] Admin vendor registration and verification flow
- [ ] Vendor list and detail API endpoints
- [ ] Vendor search and category filtering
- [ ] Conditional disbursement (funds released on enrollment confirmation)

---

## Phase 5 — Loan Lifecycle 💰
*Goal: Users can apply for and repay learner installment loans*

- [ ] Loan quote endpoint (amount, schedule, interest rate)
- [ ] Loan creation via Soroban CreditLine contract
- [ ] Per-installment repayment tracking
- [ ] Loan status indexer (BNPL events → Supabase)
- [ ] Available credit endpoint based on reputation score
- [ ] Grace period management
- [ ] Late fee accrual
- [ ] Loan default and guarantee recovery flow
- [ ] Loan history and detail endpoints

---

## Phase 6 — Liquidity Pool 💧
*Goal: Sponsors and contributors fund the learner pool*

- [ ] Liquidity pool contract deployed
- [ ] Sponsor deposit flow (companies funding learner pools)
- [ ] Individual LP investor deposit and withdrawal
- [ ] Share-based accounting (deposit → shares → withdrawal)
- [ ] Interest distribution (85% LPs / 10% protocol / 5% vendor fund)
- [ ] Pool stats endpoint (total liquidity, locked, APY)
- [ ] Investor position endpoint

---

## Phase 7 — Vouching System 🤝
*Goal: Mentors vouch for learners to boost their credit limit*

- [ ] Vouching smart contract
- [ ] Mentor registration and verification
- [ ] Vouch request flow (learner requests vouch from mentor)
- [ ] Vouch approval and on-chain recording
- [ ] Credit limit boost based on vouch count (max 3 vouches)
- [ ] Vouch expiry and revocation
- [ ] Vouch history endpoints

---

## Phase 8 — Notifications & Reminders 🔔
*Goal: Users never miss a payment*

- [ ] Daily payment reminder job (3 days, 1 day, overdue)
- [ ] Transaction status notifications (success, failed)
- [ ] Loan approval notifications
- [ ] Reputation score change alerts
- [ ] Mark as read and read-all endpoints
- [ ] Push notification support (future)

---

## Phase 9 — Testing & Quality 🧪
*Goal: Production-grade test coverage*

- [ ] Unit tests for all services (target 80% coverage)
- [ ] E2E tests for full loan lifecycle
- [ ] E2E tests for auth flow
- [ ] Contract integration tests on testnet
- [ ] CI pipeline for all tests
- [ ] Load testing for BullMQ jobs

---

## Phase 10 — Mainnet & Growth 🚀
*Goal: Launch on Stellar mainnet*

- [ ] Security audit of all Soroban contracts
- [ ] Mainnet contract deployment
- [ ] Production Supabase setup with backups
- [ ] Production Redis with persistence
- [ ] Monitoring dashboards (Sentry + Pino)
- [ ] Drips Wave integration for contributor rewards
- [ ] StepFi-App mobile release (React Native + Expo)
- [ ] First learner cohort onboarded

---

## Contributing

Each phase has open issues on GitHub labeled by phase. Pick an issue, comment to claim it, and submit a PR. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full process.

Good first issues are labeled `good first issue` — perfect if you're new to the codebase.

---

*Built for learners. Built in the open. Built on Stellar.* 🌍
