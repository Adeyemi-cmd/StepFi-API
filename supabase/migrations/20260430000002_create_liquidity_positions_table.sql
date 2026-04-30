CREATE TABLE IF NOT EXISTS liquidity_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL UNIQUE,
    shares NUMERIC(20, 7) NOT NULL DEFAULT 0,
    total_deposited NUMERIC(20, 7) NOT NULL DEFAULT 0,
    total_withdrawn NUMERIC(20, 7) NOT NULL DEFAULT 0,
    last_deposit_at TIMESTAMPTZ,
    last_withdraw_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_liquidity_positions_wallet ON liquidity_positions(wallet_address);

ALTER TABLE liquidity_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own liquidity position"
    ON liquidity_positions FOR SELECT
    USING (wallet_address = current_setting('app.current_wallet', true));

CREATE POLICY "Service role full access on liquidity_positions"
    ON liquidity_positions FOR ALL
    USING (auth.role() = 'service_role');
