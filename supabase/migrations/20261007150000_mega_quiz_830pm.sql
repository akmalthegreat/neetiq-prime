-- Move the Daily Mega Quiz to 8:30 PM IST and let the server write push subscriptions.
-- Safe to run more than once.

GRANT ALL ON public.push_subscriptions, public.push_jobs, public.push_config TO service_role;
GRANT ALL ON public.mega_syllabus, public.mega_quizzes, public.mega_items, public.mega_entries,
             public.mega_answers, public.mega_locked TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Swap the 6:00 PM start (and its wording) for 8:30 PM in every Mega Quiz function.
DO $$
DECLARE r record; d text;
BEGIN
  FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname IN ('public','private') AND p.prokind = 'f'
              AND (p.prosrc LIKE '%''18:00''%' OR p.prosrc LIKE '%6:0_ PM%' OR p.prosrc LIKE '%tomorrow at 6 PM%') LOOP
    d := pg_get_functiondef(r.oid);
    d := replace(d, 'time ''18:00''', 'time ''20:30''');
    d := replace(d, 'live at 6:00 PM', 'live at 8:30 PM');
    d := replace(d, 'Entry closes 6:05 PM', 'Entry closes 8:35 PM');
    d := replace(d, 'tomorrow at 6 PM', 'tomorrow at 8:30 PM');
    EXECUTE d;
  END LOOP;
END $$;

-- pg_cron runs in UTC (IST = UTC + 5:30):
--   build 8:00 PM, reminder 8:15 PM, score + pay 9:22 PM, results push 9:23 PM.
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'mega_quiz_build'),    schedule := '30 14 * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'mega_push_reminder'), schedule := '45 14 * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'mega_quiz_finalize'), schedule := '52 15 * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'mega_push_results'),  schedule := '53 15 * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'push_runner'),        schedule := '* 14-16 * * *');

-- Deliver in-app notifications from the database itself, so they never wait on the website.
SELECT cron.schedule('push_in_app', '* 14-16 * * *',
  $$ select public.push_job_in_app(id) from public.push_jobs where not in_app_done; $$);
