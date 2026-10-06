import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Supabase public configuration for the browser build.
// The publishable key is safe to expose; never put a secret/service-role key here.
const DEFAULT_SUPABASE_URL = "https://cupvxfoikjkufudgehsr.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_nf8Wxiem72CjlflGQb7wIw_f4wcILN3";

const MY_SUPABASE_URL = JSON.stringify(
  process.env.MY_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
);
const MY_SUPABASE_PUBLISHABLE_KEY = JSON.stringify(
  process.env.MY_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY
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
      __MY_SUPABASE_PUBLISHABLE_KEY__: MY_SUPABASE_PUBLISHABLE_KEY,
    },
  },
});