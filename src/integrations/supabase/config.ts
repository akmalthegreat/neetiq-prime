// External Supabase project configuration.
// URL and publishable (anon) key are PUBLIC values, safe to embed in client code.
// Injected at build time or fallback to configured defaults.

const DEFAULT_SUPABASE_URL = "https://cupvxfoikjkufudgehsr.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cHZ4Zm9pa2prdWZ1ZGdlaHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NTMwMjQsImV4cCI6MjA5NDIyOTAyNH0.nhbTRc6GrzWXOXkxbfNp9tVr1zYiOAXKG_mh2wQTpiA";

declare const __MY_SUPABASE_URL__: string | undefined;
declare const __MY_SUPABASE_ANON_KEY__: string | undefined;

export const SUPABASE_URL: string =
  (typeof __MY_SUPABASE_URL__ !== "undefined" && __MY_SUPABASE_URL__) ||
  DEFAULT_SUPABASE_URL;

export const SUPABASE_PUBLISHABLE_KEY: string =
  (typeof __MY_SUPABASE_ANON_KEY__ !== "undefined" && __MY_SUPABASE_ANON_KEY__) ||
  DEFAULT_SUPABASE_ANON_KEY;

export const SUPABASE_STORAGE_URL: string = `${SUPABASE_URL}/storage/v1/object/public`;
