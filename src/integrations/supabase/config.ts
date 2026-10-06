// External Supabase project configuration.
// The publishable key is public and safe to embed in client code.
// It must be supplied through the deployment environment; no legacy API key fallback is used.

const DEFAULT_SUPABASE_URL = "https://cupvxfoikjkufudgehsr.supabase.co";

declare const __MY_SUPABASE_URL__: string | undefined;
declare const __MY_SUPABASE_PUBLISHABLE_KEY__: string | undefined;

export const SUPABASE_URL: string =
  (typeof __MY_SUPABASE_URL__ !== "undefined" && __MY_SUPABASE_URL__) ||
  DEFAULT_SUPABASE_URL;

export const SUPABASE_PUBLISHABLE_KEY: string =
  (typeof __MY_SUPABASE_PUBLISHABLE_KEY__ !== "undefined" &&
    __MY_SUPABASE_PUBLISHABLE_KEY__) ||
  "";

export const SUPABASE_STORAGE_URL: string = `${SUPABASE_URL}/storage/v1/object/public`;

export function getPublicSupabaseConfig() {
  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_PUBLISHABLE_KEY,
  };
}
