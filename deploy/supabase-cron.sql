-- Enable pg_cron, pg_net, and Vault in the Supabase dashboard first.
-- In Vault, create these secrets (values never belong in this file):
--   toga_app_url    = https://YOUR_PROJECT.vercel.app
--   toga_cron_secret = the same CRON_SECRET configured in Vercel
-- This schedule works independently of Vercel Hobby's daily cron limit.
SELECT cron.schedule(
  'toga-rental-jobs',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'toga_app_url') || '/api/jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'toga_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
