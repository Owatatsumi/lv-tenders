/**
 * AI-выжимка тендеров: берёт из `tenders` записи с ai_summary IS NULL,
 * открывает страницу закупки на eis.gov.lv, отправляет её текст в Claude
 * и сохраняет выжимку из 3 пунктов (на латышском) обратно в базу.
 *
 * Запуск: npm run summarize
 * Требует в .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 * Необязательно: SUMMARY_MODEL (по умолчанию claude-haiku-5-5)
 */
import { existsSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@supabase/supabase-js";
import { chromium, type Browser } from "playwright";
import { z } from "zod";
import type { Database, Tender } from "../lib/database.types";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const MODEL = process.env.SUMMARY_MODEL ?? "claude-haiku-5-5";
const MAX_PAGE_CHARS = 12_000;

/** Жёсткий лимит на пункт: ~1–2 коротких предложения. Длиннее — один повторный запрос. */
const MAX_POINT_CHARS = 220;

const SummarySchema = z.object({
  butiba: z.string().describe("Kas tiek iepirkts un kam. 1 īss teikums."),
  budzets_un_termini: z
    .string()
    .describe("Paredzamā līgumcena, iesniegšanas termiņš (datums un laiks), izpildes laiks. 1–2 īsi teikumi."),
  prasibas: z
    .string()
    .describe("Svarīgākās prasības vai nosacījumi pretendentam. 1–2 īsi teikumi."),
});
type Summary = z.infer<typeof SummarySchema>;

const SYSTEM_PROMPT = `Tu esi asistents Latvijas mazajiem uzņēmumiem, kas seko publiskajiem iepirkumiem.
No iepirkuma datiem sagatavo ļoti īsu kopsavilkumu latviešu valodā trīs punktos:
1) būtība, 2) budžets un termiņi, 3) galvenās prasības pretendentam.

Stingri noteikumi par apjomu:
- Katrs punkts: MAKSIMĀLI 1–2 īsi teikumi, ne vairāk kā ${MAX_POINT_CHARS} rakstzīmes.
- Raksti tikai to, kas palīdz uzņēmumam izlemt, vai piedalīties. Bez ievadfrāzēm.
- Neatkārto nosaukumu, pasūtītāja reģistrācijas numuru, CPV kodus, iepirkuma identifikācijas numuru un procedūras veidu.
- Budžetā: kopsumma ar valūtu (piem., 233 000 EUR); daļas tikai tad, ja to ir 2–3. Termiņš formātā 24.11.2026 plkst. 09:00.

Saturs:
- Izmanto tikai sniegtos datus. Neizdomā summas, datumus vai prasības.
- Ja informācijas nav, raksti "Nav norādīts".
- Ja konkrētu prasību lapā nav, raksti vienu teikumu: "Prasības — nolikumā (EIS dokumenti)." un, ja ir, vienu svarīgu nosacījumu (piem., vērtēšanas kritērijs vai objekta apsekošana).`;

function tooLong(s: Summary): string[] {
  return Object.entries(s)
    .filter(([, text]) => text.trim().length > MAX_POINT_CHARS)
    .map(([key, text]) => `${key} (${text.trim().length})`);
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env.local`);
  return value;
}

function formatSummary(s: Summary): string {
  return [
    `• Būtība: ${s.butiba.trim()}`,
    `• Budžets un termiņi: ${s.budzets_un_termini.trim()}`,
    `• Prasības pretendentam: ${s.prasibas.trim()}`,
  ].join("\n");
}

/** Текст страницы закупки (все разделы уже есть в HTML, просто свёрнуты). */
async function fetchTenderPageText(browser: Browser, url: string): Promise<string> {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const text = await page.evaluate(() => {
      const body = document.body.cloneNode(true) as HTMLElement;
      body.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
      return body.innerText || body.textContent || "";
    });
    const clean = text.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
    const start = clean.indexOf("Procurement basic data");
    const end = clean.indexOf("System warning", start);
    return clean
      .slice(start >= 0 ? start : 0, end > start ? end : undefined)
      // контактное лицо заказчика модели не нужно
      .replace(/Contact person:\s*\n?[^\n]*/g, "")
      .slice(0, MAX_PAGE_CHARS);
  } finally {
    await page.close();
  }
}

async function summarize(client: Anthropic, tender: Tender, pageText: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Nosaukums: ${tender.title}
Pasūtītājs: ${tender.customer_name ?? "Nav norādīts"}
Saite: ${tender.url}

Iepirkuma lapas teksts (EIS):
${pageText || "(lapas teksts nav pieejams)"}`,
    },
  ];

  // Первая попытка + максимум один повтор, если какой-то пункт длиннее лимита
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      output_config: {
        effort: "low",
        format: zodOutputFormat(SummarySchema),
      },
      messages,
    });

    if (response.stop_reason === "refusal") {
      throw new Error(`Model refused: ${response.stop_details?.category ?? "unknown"}`);
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      throw new Error(`No structured output (stop_reason: ${response.stop_reason})`);
    }

    const long = tooLong(response.parsed_output);
    if (long.length === 0 || attempt === 2) {
      if (long.length > 0) console.warn(`  ! still long after retry: ${long.join(", ")}`);
      return formatSummary(response.parsed_output);
    }

    messages.push(
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: `Pārāk gari punkti: ${long.join(", ")}. Saīsini katru punktu līdz 1–2 īsiem teikumiem (≤ ${MAX_POINT_CHARS} rakstzīmes), saglabājot summas un termiņus.`,
      },
    );
  }
  throw new Error("unreachable");
}

async function main() {
  const supabase = createClient<Database>(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const anthropic = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });

  const { data: tenders, error } = await supabase
    .from("tenders")
    .select("*")
    .is("ai_summary", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Supabase select failed: ${error.message}`);

  console.log(`Tenders without summary: ${tenders.length} (model: ${MODEL})`);
  if (tenders.length === 0) return;

  const browser = await chromium.launch({ headless: true });
  let ok = 0;
  let failed = 0;
  try {
    for (const tender of tenders) {
      try {
        const pageText = await fetchTenderPageText(browser, tender.url);
        const summary = await summarize(anthropic, tender, pageText);

        const { error: updateError } = await supabase
          .from("tenders")
          .update({ ai_summary: summary })
          .eq("id", tender.id);
        if (updateError) throw new Error(`Supabase update failed: ${updateError.message}`);

        ok++;
        console.log(`\n✓ [${tender.external_id}] ${tender.title}\n${summary}`);
      } catch (err) {
        failed++;
        if (err instanceof Anthropic.AuthenticationError) throw err; // неверный ключ — дальше нет смысла
        const message =
          err instanceof Anthropic.APIError ? `API error ${err.status}: ${err.message}` : String(err);
        console.error(`\n✗ [${tender.external_id}] ${tender.title}\n  ${message}`);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\nDone: ${ok} summarized, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
