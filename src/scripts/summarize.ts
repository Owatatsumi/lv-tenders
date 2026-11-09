/**
 * AI-сводки (LV/RU/EN) для тендеров без ai_summary.
 *
 *   npm run summarize                  # до 40 тендеров за запуск
 *   npm run summarize -- --limit=100
 *
 * Требует в .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 * Необязательно: SUMMARY_MODEL (по умолчанию claude-haiku-5-5)
 * Логика — в src/lib/pipeline/summarize.ts (её же вызывает cron-роут /api/cron/scrape).
 */
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_SUMMARY_MODEL, summarizeTenders } from "../lib/pipeline/summarize";
import { createScriptSupabase, env, intArg, runMain } from "./cli";

runMain(async () => {
  const stats = await summarizeTenders({
    supabase: createScriptSupabase(),
    anthropic: new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") }),
    model: process.env.SUMMARY_MODEL ?? DEFAULT_SUMMARY_MODEL,
    limit: intArg("limit", 40),
  });

  console.log(
    `\nDone: ${stats.summarized} summarized, ${stats.failed.length} failed` +
      (stats.remaining > 0 ? `, ${stats.remaining} still waiting (run again)` : ""),
  );
  if (stats.failed.length > 0) process.exitCode = 1;
});
