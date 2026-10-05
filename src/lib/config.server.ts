import process from "node:process";

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
    databaseUrl:
      process.env.DATABASE_URL ||
      "postgresql://postgres:Sahil0987%40%23akmal@db.cupvxfoikjkufudgehsr.supabase.co:5432/postgres",
    supabaseUrl:
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      "https://cupvxfoikjkufudgehsr.supabase.co",
  };
}
