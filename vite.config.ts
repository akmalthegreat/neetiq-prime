import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Inject user's external Supabase URL + anon key at build time.
// These come from runtime secrets (MY_SUPABASE_URL, MY_SUPABASE_ANON_KEY) so they
// are baked into the client bundle without using the reserved VITE_ prefix.
const MY_SUPABASE_URL = JSON.stringify(process.env.MY_SUPABASE_URL ?? "");
const MY_SUPABASE_ANON_KEY = JSON.stringify(process.env.MY_SUPABASE_ANON_KEY ?? "");

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
