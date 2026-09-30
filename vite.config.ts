import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Fallback to the project's public Supabase URL and anon key if env vars are not set at build time.
const DEFAULT_SUPABASE_URL = "https://cupvxfoikjkufudgehsr.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cHZ4Zm9pa2prdWZ1ZGdlaHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NTMwMjQsImV4cCI6MjA5NDIyOTAyNH0.nhbTRc6GrzWXOXkxbfNp9tVr1zYiOAXKG_mh2wQTpiA";

const MY_SUPABASE_URL = JSON.stringify(
  process.env.MY_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
);
const MY_SUPABASE_ANON_KEY = JSON.stringify(
  process.env.MY_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY
);

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "cloudflare-module",
    output: {
      dir: "dist",
      serverDir: "dist/server",
      publicDir: "dist/client",
    },
  },
  vite: {
    define: {
      __MY_SUPABASE_URL__: MY_SUPABASE_URL,
      __MY_SUPABASE_ANON_KEY__: MY_SUPABASE_ANON_KEY,
    },
  },
});
