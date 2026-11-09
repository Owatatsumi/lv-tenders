/**
 * Сбор свежих закупок с eis.gov.lv в таблицу `tenders`.
 *
 *   npm run scrape                 # 1 страница (20 закупок)
 *   npm run scrape -- --pages=5    # 5 страниц (100 закупок)
 *
 * Уже известные тендеры пропускаются без захода на их страницу (обновляется только дедлайн).
 * Логика — в src/lib/pipeline/scrape.ts (её же вызывает cron-роут /api/cron/scrape).
 */
import { MAX_PAGES, scrapeTenders } from "../lib/pipeline/scrape";
import { createScriptSupabase, intArg, runMain } from "./cli";

runMain(async () => {
  const pages = intArg("pages", 1);
  if (pages > MAX_PAGES) console.warn(`--pages capped at ${MAX_PAGES}`);

  const stats = await scrapeTenders({ supabase: createScriptSupabase(), pages });

  console.log(
    `\nDone: ${stats.listed} listed on ${stats.pages} page(s), ${stats.inserted} new, ` +
      `${stats.skippedExisting} already in DB (skipped), ${stats.deadlinesUpdated} deadlines updated, ` +
      `${stats.failed.length} failed`,
  );
  if (stats.failed.length > 0) process.exitCode = 1;
});
