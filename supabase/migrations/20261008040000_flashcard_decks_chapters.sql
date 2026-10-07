-- Link flashcard decks to chapters (one deck per chapter).
ALTER TABLE public.flashcard_decks
  ADD COLUMN IF NOT EXISTS chapter_id text,
  ADD COLUMN IF NOT EXISTS class int;
CREATE UNIQUE INDEX IF NOT EXISTS flashcard_decks_chapter_uidx ON public.flashcard_decks(chapter_id) WHERE chapter_id IS NOT NULL;
-- Biology cards are loaded from supabase/seed/flashcards-biology.json.
