-- Migration: Create investments_index table
-- Description: Index liquidity provider positions for UI purposes
-- File: supabase/migrations/20260122120000_create_investments_index_table.sql

-- Create the investments_index table
CREATE TABLE IF NOT EXISTS investments_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    deposited_amount NUMERIC(20, 7) NOT NULL,
    shares NUMERIC(20, 7) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Check constraints to ensure non-negative values
    CONSTRAINT check_deposited_amount_non_negative CHECK (deposited_amount >= 0),
    CONSTRAINT check_shares_non_negative CHECK (shares >= 0)
);

-- Create index on wallet_address for investor position queries
CREATE INDEX idx_investments_index_wallet_address 
ON investments_index(wallet_address);

-- Create index on last_synced_at for sync job queries
CREATE INDEX idx_investments_index_last_synced_at 
ON investments_index(last_synced_at);

-- Add comment to table for documentation
COMMENT ON TABLE investments_index IS 
'Tracks investor deposits and shares in the liquidity pool. Updated by indexer jobs that sync from on-chain Liquidity Pool contract.';

-- Add comments to columns for documentation
COMMENT ON COLUMN investments_index.wallet_address IS 
'Investor''s Stellar wallet address';

COMMENT ON COLUMN investments_index.deposited_amount IS 
'Total deposited in stablecoin';

COMMENT ON COLUMN investments_index.shares IS 
'Pool shares owned';

COMMENT ON COLUMN investments_index.created_at IS 
'When position was first indexed';

COMMENT ON COLUMN investments_index.last_synced_at IS 
'Last sync from on-chain';