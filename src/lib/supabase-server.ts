import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Supabase на сервере (серверные компоненты, server actions, route handlers)
 * от имени текущего пользователя: сессия из cookies, запросы проходят через RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Вызов из серверного компонента: cookies там только читаются.
            // Это безопасно — обновлённую сессию записывает proxy.ts на каждом запросе.
          }
        },
      },
    },
  );
}

/** Есть ли у запроса валидная сессия (JWT проверяется, а не просто читается из cookie). */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  return data.claims.sub ?? null;
}
