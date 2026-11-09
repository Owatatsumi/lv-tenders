/** Общее для CLI-скриптов: .env.local, клиент Supabase с service_role, разбор аргументов. */
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env.local`);
  return value;
}

/** service_role обходит RLS — только для скриптов и серверного кода. */
export function createScriptSupabase() {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** `--pages=5` или `--pages 5` → 5. */
export function intArg(name: string, fallback: number): number {
  const args = process.argv.slice(2);
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return fallback;
  const raw = args[i].includes("=") ? args[i].split("=")[1] : args[i + 1];
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new Error(`--${name} must be a positive integer, got "${raw}"`);
  return n;
}

export function runMain(main: () => Promise<void>) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
