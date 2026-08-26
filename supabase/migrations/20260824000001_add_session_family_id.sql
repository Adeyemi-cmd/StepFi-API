-- Session families for refresh-token rotation.
-- All tokens minted from a chain of refreshes share one family_id, so that
-- replay of an already-rotated refresh token can revoke the entire family
-- (theft containment).

ALTER TABLE public.sessions
    ADD COLUMN family_id UUID NOT NULL DEFAULT gen_random_uuid();

CREATE INDEX idx_sessions_family_id ON public.sessions (family_id);
