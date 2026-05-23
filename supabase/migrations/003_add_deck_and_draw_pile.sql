-- Add deck_type and draw_pile columns to rooms table
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS deck_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS draw_pile jsonb DEFAULT '[]'::jsonb;
