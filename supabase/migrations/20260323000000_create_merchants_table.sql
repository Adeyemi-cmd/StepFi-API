-- Migration: create merchants table
-- Description: Registry of authorized merchants accepting BNPL loans via TrustUp.
-- Idempotent: supports safe re-runs with IF NOT EXISTS

CREATE TABLE IF NOT EXISTS public.merchants (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Stellar public key of the merchant (G...)
  wallet           VARCHAR(56)  UNIQUE NOT NULL,
  
  -- Business name
  name             VARCHAR(255) NOT NULL,
  
  -- Branding & Info
  logo             TEXT,
  description      TEXT,
  category         VARCHAR(100),
  website          TEXT,
  
  -- Control flag
  is_active        BOOLEAN      DEFAULT true,
  
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'merchants_wallet_format_check'
  ) THEN
    ALTER TABLE public.merchants
      ADD CONSTRAINT merchants_wallet_format_check
      CHECK (wallet ~ '^G[A-Z2-7]{55}$');
  END IF;
END;
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_merchants_wallet ON public.merchants(wallet);
CREATE INDEX IF NOT EXISTS idx_merchants_active ON public.merchants(is_active);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.set_merchants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_merchants_updated_at'
  ) THEN
    CREATE TRIGGER trg_merchants_updated_at
    BEFORE UPDATE ON public.merchants
    FOR EACH ROW
    EXECUTE FUNCTION public.set_merchants_updated_at();
  END IF;
END;
$$;

-- Comments
COMMENT ON TABLE public.merchants IS 'Registry of merchants approved for BNPL transactions.';
COMMENT ON COLUMN public.merchants.wallet IS 'Stellar wallet address (G...) used for settlement.';
COMMENT ON COLUMN public.merchants.is_active IS 'False disables new loan creation for this merchant.';
