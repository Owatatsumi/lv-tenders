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

/** Сколько тендеров отдаём за раз (первая страница и каждое «Загрузить ещё»). 12 делится на 1/2/3 колонки. */
export const PAGE_SIZE = 12;
const MAX_QUERY_LENGTH = 100;
const MAX_QUERY_WORDS = 5;

export type TenderPage = { items: TenderListItem[]; total: number; hasMore: boolean };

/**
 * Слова поискового запроса. Убираем символы, которые ломают синтаксис фильтра PostgREST (`"` и `\`)
 * или работают как маски LIKE (`%`, `_`, `*`) — пользователь ищет текст, а не шаблон.
 */
export function parseQuery(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .slice(0, MAX_QUERY_LENGTH)
    .replace(/["\\%_*]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_QUERY_WORDS);
}

/**
 * Поиск и пагинация тендеров (новые сверху).
 *
 * Поиск без учёта регистра (ilike): каждое слово должно встретиться хотя бы в одном поле.
 * - Все: оригинальное название (title) и переведённые названия ai_summary->{lv,ru,en}->>title.
 * - Только авторизованные: ещё и текст сводок ai_summary->{lv,ru,en}->>summary. Гостям поиск
 *   по сводкам не даём — иначе по совпадениям можно было бы «вытащить» скрытый текст.
 *
 * Доступ:
 * - Авторизованный пользователь: читаем от его имени (сессия из cookies) — RLS разрешает SELECT
 *   для роли authenticated; сводки отдаются полностью.
 * - Гость: RLS роли anon ничего не отдаёт, поэтому читаем service_role на сервере, но ТЕКСТ СВОДОК
 *   ВЫРЕЗАЕМ ДО отправки на клиент — в HTML/RSC-ответе гостя его нет, блюр в UI только декоративный.
 */
export async function searchTenders({
  authenticated,
  query,
  offset = 0,
  limit = PAGE_SIZE,
}: {
  authenticated: boolean;
  query?: string | null;
  offset?: number;
  limit?: number;
}): Promise<TenderPage> {
  const supabase = authenticated ? await createClient() : createAdminClient();

  const fields = [
    "title",
    ...LOCALES.map((l) => `ai_summary->${l}->>title`),
    ...(authenticated ? LOCALES.map((l) => `ai_summary->${l}->>summary`) : []),
  ];

  let request = supabase
    .from("tenders")
    .select(COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true }) // стабильный порядок при одинаковом created_at — без дублей между страницами
    .range(offset, offset + limit - 1);

  // каждое .or() — отдельное условие, они объединяются через AND
  for (const word of parseQuery(query)) {
    request = request.or(fields.map((f) => `${f}.ilike."%${word}%"`).join(","));
  }

  const { data, count, error } = await request;
  if (error) throw new Error(`Failed to load tenders: ${error.message}`);

  const total = count ?? data.length;
  return {
    items: data.map((row) => toListItem(row, authenticated)),
    total,
    hasMore: offset + data.length < total,
  };
}
