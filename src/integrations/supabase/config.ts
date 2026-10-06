// External Supabase project configuration.
// The publishable key is public and safe to embed in client code.
// Prefer the build-time value; use the active project publishable key as a safe fallback
// so the app cannot fall back to a disabled legacy anon key.

const DEFAULT_SUPABASE_URL = "https://cupvxfoikjkufudgehsr.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_nf8Wxiem72CjlflGQb7wIw_f4wcILN3";

declare const __MY_SUPABASE_URL__: string | undefined;
declare const __MY_SUPABASE_PUBLISHABLE_KEY__: string | undefined;

export const SUPABASE_URL: string =
  (typeof __MY_SUPABASE_URL__ !== "undefined" && __MY_SUPABASE_URL__) ||
  DEFAULT_SUPABASE_URL;

export const SUPABASE_PUBLISHABLE_KEY: string =
  (typeof __MY_SUPABASE_PUBLISHABLE_KEY__ !== "undefined" && __MY_SUPABASE_PUBLISHABLE_KEY__) ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const SUPABASE_STORAGE_URL: string = `${SUPABASE_URL}/storage/v1/object/public`;

export function getPublicSupabaseConfig() {
  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_PUBLISHABLE_KEY,
  };
}