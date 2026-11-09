/**
 * Сбор тендеров из EIS (общая логика для CLI `npm run scrape` и cron-роута на Vercel).
 *
 * 1. Список: N страниц по 20 закупок через JSON-API EIS (новые сверху).
 * 2. Дубликаты: одним запросом к Supabase ищем, какие из них уже есть в базе
 *    (по external_id и по url). Для известных тендеров НЕ открываем страницу закупки и НЕ
 *    тратим токены Claude — только обновляем дедлайн, если заказчик его продлил (он есть в списке).
 * 3. Новые: открываем страницу закупки (описание), сохраняем. Сводку делает summarizeTenders().
 *
 * По названию дубликаты не ищем намеренно: у разных закупок бывают одинаковые названия
 * («Pārtikas produktu piegāde…» каждый год), и мы бы теряли настоящие новые тендеры.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TenderInsert } from "../database.types";
import { fetchListPage, fetchTenderDetails, openEisSession, type EisListItem } from "../eis/client";
import type { Logger } from "./summarize";

/** Больше страниц за раз не берём — бережём EIS и время выполнения функции. */
export const MAX_PAGES = 10;

export type ScrapeStats = {
  pages: number;
  /** уникальных закупок в списке */
  listed: number;
  /** уже были в базе — пропущены без захода на страницу закупки */
  skippedExisting: number;
  /** у уже известных тендеров обновлён дедлайн (продление срока) */
  deadlinesUpdated: number;
  inserted: number;
  insertedIds: string[];
  failed: { externalId: string; error: string }[];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function scrapeTenders({
  supabase,
  pages = 1,
  delayMs = 400,
  log = console.log,
}: {
  supabase: SupabaseClient<Database>;
  pages?: number;
  /** пауза между запросами к страницам закупок — не нагружаем гос. портал */
  delayMs?: number;
  log?: Logger;
}): Promise<ScrapeStats> {
  const pageCount = Math.min(Math.max(1, Math.floor(pages)), MAX_PAGES);
  const stats: ScrapeStats = {
    pages: pageCount,
    listed: 0,
    skippedExisting: 0,
    deadlinesUpdated: 0,
    inserted: 0,
    insertedIds: [],
    failed: [],
  };

  const session = await openEisSession();
  const seen = new Set<string>();

  for (let page = 0; page < pageCount; page++) {
    if (page > 0) await sleep(delayMs);
    const items = (await fetchListPage(session, page)).filter((i) => !seen.has(i.externalId));
    items.forEach((i) => seen.add(i.externalId));
    stats.listed += items.length;
    log(`Page ${page + 1}/${pageCount}: ${items.length} tenders`);
    if (items.length === 0) break; // страницы закончились

    // --- Дубликаты: какие из этих закупок уже есть в базе? (по external_id и по url)
    const existing = await findExisting(supabase, items);
    const fresh = items.filter((i) => !existing.has(i.externalId));
    stats.skippedExisting += items.length - fresh.length;

    // Для известных тендеров — только дешёвое обновление дедлайна из списка (если его продлили)
    for (const item of items) {
      const known = existing.get(item.externalId);
      if (known && item.deadline && !sameMoment(known.deadline, item.deadline)) {
        const { error } = await supabase.from("tenders").update({ deadline: item.deadline }).eq("id", known.id);
        if (!error) {
          stats.deadlinesUpdated++;
          log(`  ↻ [${item.externalId}] deadline ${known.deadline ?? "—"} → ${item.deadline}`);
        }
      }
    }

    // --- Новые: страница закупки (описание) и вставка
    const rows: TenderInsert[] = [];
    for (const item of fresh) {
      await sleep(delayMs);
      try {
        const details = await fetchTenderDetails(item.externalId);
        rows.push({
          external_id: item.externalId,
          title: item.title,
          customer_name: item.customer,
          deadline: item.deadline ?? details.deadline,
          url: item.url,
          description: details.description,
        });
      } catch (err) {
        stats.failed.push({ externalId: item.externalId, error: String(err) });
        log(`  ✗ [${item.externalId}] ${String(err)}`);
      }
    }

    if (rows.length > 0) {
      // ignoreDuplicates: если тендер успел появиться параллельно (второй запуск крона) — не трогаем его
      const { data, error } = await supabase
        .from("tenders")
        .upsert(rows, { onConflict: "external_id", ignoreDuplicates: true })
        .select("external_id");
      if (error) throw new Error(`Supabase insert failed: ${error.message}`);
      stats.inserted += data.length;
      stats.insertedIds.push(...data.map((r) => r.external_id));
      data.forEach((r) => log(`  + [${r.external_id}] ${rows.find((x) => x.external_id === r.external_id)?.title}`));
    }
    log(`  page ${page + 1}: ${fresh.length} new, ${items.length - fresh.length} already in DB`);
  }

  return stats;
}

type ExistingRow = { id: string; deadline: string | null };

async function findExisting(
  supabase: SupabaseClient<Database>,
  items: EisListItem[],
): Promise<Map<string, ExistingRow>> {
  const byId = await supabase
    .from("tenders")
    .select("id, external_id, url, deadline")
    .in("external_id", items.map((i) => i.externalId));
  if (byId.error) throw new Error(`Supabase select failed: ${byId.error.message}`);

  const byUrl = await supabase
    .from("tenders")
    .select("id, external_id, url, deadline")
    .in("url", items.map((i) => i.url));
  if (byUrl.error) throw new Error(`Supabase select failed: ${byUrl.error.message}`);

  const result = new Map<string, ExistingRow>();
  for (const row of [...byId.data, ...byUrl.data]) {
    const item = items.find((i) => i.externalId === row.external_id || i.url === row.url);
    if (item) result.set(item.externalId, { id: row.id, deadline: row.deadline });
  }
  return result;
}

function sameMoment(a: string | null, b: string | null): boolean {
  if (!a || !b) return a === b;
  return new Date(a).getTime() === new Date(b).getTime();
}
