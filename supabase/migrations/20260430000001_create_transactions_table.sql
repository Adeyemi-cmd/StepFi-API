CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    tx_hash TEXT UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('loan_create', 'loan_repay', 'liquidity_deposit', 'liquidity_withdraw')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    unsigned_xdr TEXT,
    signed_xdr TEXT,
    result_xdr TEXT,
    error_message TEXT,
    loan_id BIGINT,
    amount NUMERIC(20, 7),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_wallet ON transactions(wallet_address);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_tx_hash ON transactions(tx_hash);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
    ON transactions FOR SELECT
    USING (wallet_address = current_setting('app.current_wallet', true));

CREATE POLICY "Service role full access on transactions"
    ON transactions FOR ALL
    USING (auth.role() = 'service_role');
