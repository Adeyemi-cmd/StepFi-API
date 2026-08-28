-- #118: bind nonce rows to the exact challenge message wallets must sign.
--
-- Previously a nonce row only stored the random value, and the server accepted
-- signatures over several ad-hoc payloads (raw nonce hex, "Stellar Signing
-- Key: <nonce>"), none of which bound the signature to StepFi. This made
-- captured (nonce, signature) pairs from other contexts replayable here.
--
-- New columns:
--   issued_at   — the ISO timestamp embedded in the canonical challenge
--                 envelope as "issuedAt" (server time at issue time, so the
--                 envelope can be reconstructed byte-for-byte).
--   message_hash — SHA-256 hex digest of the exact challenge message text the
--                 wallet must sign. Verification only ever runs against a
--                 message whose digest matches this value, so a nonce can
--                 never be redeemed with client-supplied alternative content.
--
-- Both columns are nullable so pre-existing (legacy) rows keep working during
-- the documented migration window; new rows always populate them.

ALTER TABLE public.nonces
    ADD COLUMN issued_at TIMESTAMPTZ,
    ADD COLUMN message_hash TEXT;

COMMENT ON COLUMN public.nonces.issued_at IS
    'ISO timestamp embedded in the canonical challenge envelope (issuedAt). Null for pre-migration rows.';
COMMENT ON COLUMN public.nonces.message_hash IS
    'SHA-256 hex digest of the exact challenge message the wallet must sign. Binds the nonce row to its challenge content.';
