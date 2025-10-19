-- Phục vụ keyset pagination
CREATE INDEX IF NOT EXISTS idx_novels_updated_at_id
ON public.novels (updated_at DESC, id);
