// External Supabase project configuration.
// URL and publishable (anon) key are PUBLIC values, safe to embed in client code.
// These are injected at build time from MY_SUPABASE_URL / MY_SUPABASE_ANON_KEY secrets
// via vite.config.ts `define`. The service role key stays server-only (read from
// MY_SUPABASE_SERVICE_ROLE_KEY in client.server.ts).

declare const __MY_SUPABASE_URL__: string;
declare const __MY_SUPABASE_ANON_KEY__: string;

export const SUPABASE_URL: string = __MY_SUPABASE_URL__;
export const SUPABASE_PUBLISHABLE_KEY: string = __MY_SUPABASE_ANON_KEY__;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  // Surface a clear error at module load instead of cryptic Supabase failures later.
  // eslint-disable-next-line no-console
  console.error(
    "[Supabase] Missing MY_SUPABASE_URL or MY_SUPABASE_ANON_KEY at build time. " +
      "Add them in Project Settings → Secrets and rebuild.",
  );
}
