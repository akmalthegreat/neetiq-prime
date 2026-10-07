-- Target 700 Batch test series support. Safe to run more than once.
-- (The 46 tests themselves were generated from the question bank and stored in public.tests
--  with series = 'target-700'.)

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS series text,
  ADD COLUMN IF NOT EXISTS series_seq integer,
  ADD COLUMN IF NOT EXISTS series_label text,
  ADD COLUMN IF NOT EXISTS series_group text;
CREATE INDEX IF NOT EXISTS tests_series_idx ON public.tests (series, series_seq) WHERE series IS NOT NULL;

-- Old mock tests are kept (students' results stay) but hidden from the Mock tests page.
UPDATE public.tests SET archived = true WHERE type = 'mock' AND series IS NULL AND archived = false;

-- Banners can be text-only.
ALTER TABLE public.dashboard_banners ALTER COLUMN image_url DROP NOT NULL;
