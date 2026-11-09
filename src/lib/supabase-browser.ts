import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Supabase в браузере (клиентские компоненты): сессия хранится в cookies,
 * поэтому сервер (proxy, серверные компоненты, server actions) видит того же пользователя.
 * createBrowserClient сам переиспользует один экземпляр на вкладку.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
