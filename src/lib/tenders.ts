import "server-only";
import { createAdminClient } from "./supabase-admin";
import type { Tender } from "./database.types";

export type TenderListItem = Pick<
  Tender,
  "id" | "external_id" | "title" | "customer_name" | "deadline" | "url" | "ai_summary" | "created_at"
>;

/**
 * Последние тендеры для дашборда (серверный запрос).
 *
 * Временно читаем через service_role: RLS разрешает SELECT только авторизованным
 * пользователям, а авторизации в приложении пока нет. Клиент живёт только на сервере
 * ("server-only"), наружу уходят лишь публичные поля закупок из EIS.
 * TODO: после добавления Supabase Auth перейти на клиент с сессией пользователя.
 */
export async function getLatestTenders(limit = 20): Promise<TenderListItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tenders")
    .select("id, external_id, title, customer_name, deadline, url, ai_summary, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load tenders: ${error.message}`);
  return data;
}
