// Server-side Supabase admin client (service role - bypasses RLS).
// SECURITY: Only import from server-only paths (createServerFn handlers, server routes).
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config';

function createSupabaseAdminClient() {
  // Accept the configured server-side Supabase service-role secret.
  const SERVICE_ROLE_KEY =
    process.env.PROJECT_SERVICE_ROLE_KEY ||
    process.env.APP_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.MY_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  const key = SERVICE_ROLE_KEY || SUPABASE_PUBLISHABLE_KEY;
  if (!SERVICE_ROLE_KEY) {
    console.warn(
      '[Supabase] Missing PROJECT_SERVICE_ROLE_KEY env var. Falling back to publishable key to prevent server crash.'
    );
  }

  return createClient<Database>(SUPABASE_URL, key, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
