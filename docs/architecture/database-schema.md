# Database Schema

This document describes the PostgreSQL database schema used by the StepFi API via Supabase.

## Overview

The database stores off-chain data to complement on-chain smart contracts, providing:
- User profiles and preferences
- Merchant registry
- Indexed blockchain events
- Transaction history
- Notifications
- Caching layer for performance

## Tables

### users

Stores user profile information.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet VARCHAR(56) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_wallet ON users(wallet);
```

**Columns**:
- `id`: Unique identifier
- `wallet`: Stellar wallet address (G...)
- `name`: User's display name
- `avatar`: URL to avatar image
- `preferences`: JSON object for user preferences (notifications, theme, etc.)
- `created_at`: Account creation timestamp
- `updated_at`: Last update timestamp

---

### merchants

Stores merchant information and status.

```sql
CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet VARCHAR(56) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  logo TEXT,
  description TEXT,
  category VARCHAR(100),
  website TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_merchants_wallet ON merchants(wallet);
CREATE INDEX idx_merchants_active ON merchants(is_active);
```

**Columns**:
- `id`: Unique identifier
- `wallet`: Merchant's Stellar wallet address
- `name`: Merchant business name
- `logo`: URL to merchant logo
- `description`: Merchant description
- `category`: Business category (Electronics, Fashion, etc.)
- `website`: Merchant website URL
- `is_active`: Whether merchant is accepting new loans
- `created_at`: Registration timestamp
- `updated_at`: Last update timestamp

---

### loans

Indexed loan data from blockchain.

```sql
CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id VARCHAR(100) UNIQUE NOT NULL,
  user_wallet VARCHAR(56) NOT NULL,
  merchant_id UUID REFERENCES merchants(id),
  amount DECIMAL(20, 7) NOT NULL,
  loan_amount DECIMAL(20, 7) NOT NULL,
  guarantee DECIMAL(20, 7) NOT NULL,
  interest_rate DECIMAL(5, 2) NOT NULL,
  total_repayment DECIMAL(20, 7) NOT NULL,
  remaining_balance DECIMAL(20, 7) NOT NULL,
  term INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  next_payment_due TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  defaulted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loans_user_wallet ON loans(user_wallet);
CREATE INDEX idx_loans_merchant_id ON loans(merchant_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_next_payment ON loans(next_payment_due);
```

**Columns**:
- `id`: Internal UUID
- `loan_id`: On-chain loan identifier
- `user_wallet`: Borrower's wallet address
- `merchant_id`: Reference to merchant
- `amount`: Total purchase amount
- `loan_amount`: Amount borrowed (typically 80% of amount)
- `guarantee`: Deposit amount (typically 20% of amount)
- `interest_rate`: Annual interest rate percentage
- `total_repayment`: Total amount to be repaid (loan + interest)
- `remaining_balance`: Current outstanding balance
- `term`: Loan term in months
- `status`: Loan status (active, completed, defaulted)
- `next_payment_due`: Next payment due date
- `created_at`: Loan creation timestamp
- `completed_at`: Loan completion timestamp
- `defaulted_at`: Loan default timestamp
- `updated_at`: Last update timestamp

**Status values**: `active`, `completed`, `defaulted`

---

### loan_payments

Payment history for loans.

```sql
CREATE TABLE loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
  amount DECIMAL(20, 7) NOT NULL,
  transaction_hash VARCHAR(64) NOT NULL,
  payment_number INTEGER NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX idx_payments_tx_hash ON loan_payments(transaction_hash);
```

**Columns**:
- `id`: Unique identifier
- `loan_id`: Reference to parent loan
- `amount`: Payment amount
- `transaction_hash`: Stellar transaction hash
- `payment_number`: Sequential payment number (1, 2, 3...)
- `paid_at`: Payment timestamp

---

### reputation_history

Historical reputation score changes.

```sql
CREATE TABLE reputation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet VARCHAR(56) NOT NULL,
  old_score INTEGER NOT NULL,
  new_score INTEGER NOT NULL,
  change_amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  transaction_hash VARCHAR(64),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reputation_user_wallet ON reputation_history(user_wallet);
CREATE INDEX idx_reputation_changed_at ON reputation_history(changed_at);
```

**Columns**:
- `id`: Unique identifier
- `user_wallet`: User's wallet address
- `old_score`: Score before change
- `new_score`: Score after change
- `change_amount`: Delta (can be negative)
- `reason`: Reason for change (e.g., "Loan repayment completed")
- `transaction_hash`: Associated blockchain transaction
- `changed_at`: Change timestamp

---

### liquidity_positions

Liquidity provider positions (shares).

```sql
CREATE TABLE liquidity_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_wallet VARCHAR(56) NOT NULL,
  shares DECIMAL(20, 7) NOT NULL DEFAULT 0,
  deposited_amount DECIMAL(20, 7) NOT NULL DEFAULT 0,
  first_deposit_at TIMESTAMPTZ,
  last_deposit_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_liquidity_provider ON liquidity_positions(provider_wallet);
CREATE INDEX idx_liquidity_shares ON liquidity_positions(shares);
```

**Columns**:
- `id`: Unique identifier
- `provider_wallet`: LP's wallet address
- `shares`: Current share balance
- `deposited_amount`: Total deposited over lifetime
- `first_deposit_at`: Timestamp of first deposit
- `last_deposit_at`: Timestamp of most recent deposit
- `updated_at`: Last update timestamp

---

### transactions

Transaction tracking and status.

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hash VARCHAR(64) UNIQUE NOT NULL,
  user_wallet VARCHAR(56) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  xdr TEXT,
  result JSONB,
  error TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_hash ON transactions(hash);
CREATE INDEX idx_transactions_user ON transactions(user_wallet);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_type ON transactions(type);
```

**Columns**:
- `id`: Unique identifier
- `hash`: Stellar transaction hash
- `user_wallet`: User who initiated transaction
- `type`: Transaction type (loan_create, loan_repay, deposit, withdraw)
- `status`: Current status (pending, success, failed)
- `xdr`: Transaction XDR (if applicable)
- `result`: Parsed transaction result (JSON)
- `error`: Error message if failed
- `submitted_at`: Submission timestamp
- `completed_at`: Completion timestamp
- `updated_at`: Last status check timestamp

**Status values**: `pending`, `success`, `failed`

**Type values**: `loan_create`, `loan_repay`, `liquidity_deposit`, `liquidity_withdraw`

---

### notifications

User notifications.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet VARCHAR(56) NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user ON notifications(user_wallet);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
```

**Columns**:
- `id`: Unique identifier
- `user_wallet`: Recipient's wallet address
- `type`: Notification type
- `title`: Notification title
- `message`: Notification message
- `data`: Additional JSON data (e.g., loan_id, amount)
- `is_read`: Whether notification has been read
- `created_at`: Notification creation timestamp
- `read_at`: Timestamp when marked as read

**Type values**:
- `loan_reminder`: Payment due soon
- `loan_overdue`: Payment is overdue
- `loan_completed`: Loan fully repaid
- `reputation_changed`: Reputation score updated
- `liquidity_deposited`: Deposit successful
- `liquidity_withdrawn`: Withdrawal successful

---

### nonces

Temporary nonces for wallet authentication.

```sql
CREATE TABLE nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet VARCHAR(56) NOT NULL,
  nonce VARCHAR(100) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

CREATE INDEX idx_nonces_wallet ON nonces(wallet);
CREATE INDEX idx_nonces_nonce ON nonces(nonce);
CREATE INDEX idx_nonces_expires ON nonces(expires_at);
```

**Columns**:
- `id`: Unique identifier
- `wallet`: Wallet address requesting authentication
- `nonce`: Random nonce string
- `expires_at`: Expiration timestamp (typically 5-10 minutes)
- `created_at`: Creation timestamp
- `used_at`: Timestamp when nonce was used (null if unused)

**Cleanup**: Expired nonces should be cleaned periodically via cron job.

---

### refresh_tokens

JWT refresh token storage.

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet VARCHAR(56) NOT NULL,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_wallet);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
```

**Columns**:
- `id`: Unique identifier
- `user_wallet`: Owner of the token
- `token_hash`: SHA256 hash of the refresh token
- `expires_at`: Expiration timestamp
- `created_at`: Creation timestamp
- `revoked_at`: Revocation timestamp (null if active)

**Security**: Only the hash is stored, not the actual token.

---

## Views

### active_loans_summary

Convenient view for active loans with merchant info.

```sql
CREATE VIEW active_loans_summary AS
SELECT
  l.id,
  l.loan_id,
  l.user_wallet,
  l.amount,
  l.remaining_balance,
  l.next_payment_due,
  m.name AS merchant_name,
  m.logo AS merchant_logo,
  l.created_at
FROM loans l
JOIN merchants m ON l.merchant_id = m.id
WHERE l.status = 'active'
ORDER BY l.next_payment_due ASC;
```

---

### user_stats

User statistics view.

```sql
CREATE VIEW user_stats AS
SELECT
  user_wallet,
  COUNT(*) AS total_loans,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_loans,
  SUM(CASE WHEN status = 'defaulted' THEN 1 ELSE 0 END) AS defaulted_loans,
  SUM(CASE WHEN status = 'active' THEN remaining_balance ELSE 0 END) AS total_debt
FROM loans
GROUP BY user_wallet;
```

---

## Triggers

### Update updated_at timestamp

Auto-update `updated_at` columns on row updates.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_liquidity_positions_updated_at BEFORE UPDATE ON liquidity_positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Row Level Security (RLS)

Supabase supports RLS for security. Example policies:

### Users table
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT USING (auth.uid() = wallet);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = wallet);
```

### Loans table
```sql
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

-- Users can read their own loans
CREATE POLICY "Users can read own loans" ON loans
  FOR SELECT USING (user_wallet = auth.uid());
```

### Notifications table
```sql
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (user_wallet = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_wallet = auth.uid());
```

---

## Indexes

Indexes are created for:
- Primary keys (automatic)
- Foreign keys
- Frequently queried columns (wallet addresses, status, timestamps)
- Columns used in WHERE, ORDER BY, and JOIN clauses

---

## Migrations

Database migrations are managed using Supabase migrations or TypeORM migrations.

**Migration files location**: `/supabase/migrations/`

**Example migration naming**:
```
20260213_create_users_table.sql
20260213_create_merchants_table.sql
20260213_create_loans_table.sql
```

---

## Data Retention

### Cleanup Policies

**Expired nonces**: Delete after 24 hours
```sql
DELETE FROM nonces WHERE expires_at < NOW() - INTERVAL '24 hours';
```

**Revoked refresh tokens**: Delete after 30 days
```sql
DELETE FROM refresh_tokens WHERE revoked_at < NOW() - INTERVAL '30 days';
```

**Read notifications**: Archive after 90 days (optional)
```sql
DELETE FROM notifications WHERE is_read = true AND created_at < NOW() - INTERVAL '90 days';
```

---

## Related Documentation

- [Supabase Setup](../setup/supabase-setup.md)
- [Architecture Overview](./overview.md)
- [Blockchain Layer](./blockchain-layer.md)

---

*Last Updated: 2026-02-13*
