import "server-only";
import { createAdminClient } from "./supabase-admin";
import { createClient } from "./supabase-server";
import { LOCALES, type AiSummary, type Locale, type Tender } from "./database.types";

/** Тендер для карточки. summary = null — выжимка скрыта (гость), сам текст на клиент не уходит. */
export type TenderListItem = Pick<Tender, "id" | "external_id" | "title" | "customer_name" | "deadline" | "url"> & {
  /** null — AI-выжимки для тендера ещё нет */
  localized: Record<Locale, { title: string; summary: string | null }> | null;
};

const COLUMNS = "id, external_id, title, customer_name, deadline, url, ai_summary, created_at";

function toListItem(row: Pick<Tender, "id" | "external_id" | "title" | "customer_name" | "deadline" | "url"> & { ai_summary: AiSummary | null }, withSummaries: boolean): TenderListItem {
  const { ai_summary, ...rest } = row;
  return {
    ...rest,
    localized: ai_summary
      ? (Object.fromEntries(
          LOCALES.map((l) => [l, { title: ai_summary[l].title, summary: withSummaries ? ai_summary[l].summary : null }]),
        ) as TenderListItem["localized"])
      : null,
  };
}

/**
 * Последние тендеры для дашборда (серверный запрос).
 *
 * - Авторизованный пользователь: читаем от его имени (сессия из cookies) — RLS разрешает SELECT
 *   для роли authenticated; выжимки отдаются полностью.
 * - Гость: RLS роли anon ничего не отдаёт, поэтому читаем service_role на сервере, но ТЕКСТ ВЫЖИМОК
 *   ВЫРЕЗАЕМ ДО отправки на клиент — в HTML/RSC-ответе гостя его нет, блюр в UI только декоративный.
 */
export async function getLatestTenders({ authenticated, limit = 20 }: { authenticated: boolean; limit?: number }) {
  const supabase = authenticated ? await createClient() : createAdminClient();
  const { data, error } = await supabase
    .from("tenders")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load tenders: ${error.message}`);
  return data.map((row) => toListItem(row, authenticated));
}
