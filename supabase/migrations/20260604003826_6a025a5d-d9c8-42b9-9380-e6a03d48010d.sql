CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedule with same name (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('daily-ai-dpp-10am');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'daily-ai-dpp-10am',
  '30 4 * * *', -- 10:00 IST = 04:30 UTC
  $$
  SELECT net.http_post(
    url := 'https://project--cd8174db-8406-4c30-9f20-88b906b6343c.lovable.app/api/public/hooks/generate-daily-quiz',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVra213Y2t2cHJkc3p1Y2R6ZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDI1OTgsImV4cCI6MjA5NTAxODU5OH0.eyz86ObMuRbqndgxF4UmfH6B7xxVkDhxDZvc2lhK89s"}'::jsonb,
    body := '{"count": 6}'::jsonb
  );
  $$
);