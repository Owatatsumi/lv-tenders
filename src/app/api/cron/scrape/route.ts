import { timingSafeEqual } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { scrapeTenders, type ScrapeStats } from "@/lib/pipeline/scrape";
import { DEFAULT_SUMMARY_MODEL, summarizeTenders, type SummarizeStats } from "@/lib/pipeline/summarize";
import { createAdminClient } from "@/lib/supabase-admin";

/**
 * Vercel Cron: сбор новых тендеров из EIS + AI-сводки для них.
 * Расписание — в vercel.json. Vercel сам добавляет заголовок `Authorization: Bearer <CRON_SECRET>`,
 * если в настройках проекта задана переменная CRON_SECRET.
 *
 * Ручной запуск: curl -H "Authorization: Bearer $CRON_SECRET" https://<домен>/api/cron/scrape
 */

// Серверless-функция по умолчанию живёт недолго; сбор 2 страниц + сводки укладываются в ~1–3 минуты.
export const maxDuration = 300;

const PAGES = Number(process.env.CRON_SCRAPE_PAGES ?? 2);
/** Сколько сводок делаем за один запуск — защита бюджета Claude и времени функции. Остаток — в следующий запуск. */
const SUMMARY_LIMIT = Number(process.env.CRON_SUMMARY_LIMIT ?? 40);

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // без секрета роут закрыт полностью
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  // сравнение за постоянное время — не подсказываем секрет по времени ответа
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const log = (message: string) => console.log(`[cron:scrape] ${message}`);
  const supabase = createAdminClient();

  let scrape: ScrapeStats | null = null;
  let summarize: SummarizeStats | null = null;
  const errors: string[] = [];

  try {
    scrape = await scrapeTenders({ supabase, pages: PAGES, log });
  } catch (err) {
    errors.push(`scrape: ${String(err)}`);
    log(`scrape failed: ${String(err)}`);
  }

  // Сводки делаем, даже если сбор упал: могли остаться тендеры без сводки с прошлых запусков
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    summarize = await summarizeTenders({
      supabase,
      anthropic: new Anthropic({ apiKey }),
      model: process.env.SUMMARY_MODEL ?? DEFAULT_SUMMARY_MODEL,
      limit: SUMMARY_LIMIT,
      log,
    });
  } catch (err) {
    errors.push(`summarize: ${String(err)}`);
    log(`summarize failed: ${String(err)}`);
  }

  const body = {
    ok: errors.length === 0,
    durationMs: Date.now() - startedAt,
    scraped: scrape && {
      pages: scrape.pages,
      listed: scrape.listed,
      inserted: scrape.inserted,
      skippedExisting: scrape.skippedExisting,
      deadlinesUpdated: scrape.deadlinesUpdated,
      failed: scrape.failed.length,
    },
    summarized: summarize && {
      done: summarize.summarized,
      failed: summarize.failed.length,
      remaining: summarize.remaining,
    },
    errors,
  };
  log(JSON.stringify(body));
  return NextResponse.json(body, { status: errors.length ? 500 : 200 });
}
