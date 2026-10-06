import process from "node:process";

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
    // Never keep a database password in source code. Configure DATABASE_URL
    // as a server-only deployment secret when a direct PostgreSQL connection
    // is actually required.
    databaseUrl: process.env.DATABASE_URL,
    supabaseUrl:
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      "https://cupvxfoikjkufudgehsr.supabase.co",
  };
}
