import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const DEFAULT_SUPABASE_URL = "https://cupvxfoikjkufudgehsr.supabase.co";

const MY_SUPABASE_URL = JSON.stringify(
  process.env.MY_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
);

const MY_SUPABASE_PUBLISHABLE_KEY = JSON.stringify(
  process.env.MY_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ""
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
