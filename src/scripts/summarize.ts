/**
 * AI-выжимка тендеров: берёт из `tenders` записи с ai_summary IS NULL,
 * открывает страницу закупки на eis.gov.lv, отправляет её текст в Claude
 * и сохраняет заголовок + выжимку из 3 пунктов на трёх языках в ai_summary (jsonb):
 *   {"lv": {"title": "<оригинал из EIS>", "summary": "• Būtība: …\n• …"},
 *    "ru": {"title": "<перевод>",          "summary": "• Суть: …\n• …"},
 *    "en": {"title": "<translation>",      "summary": "• Summary: …\n• …"}}
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
import { LOCALES, type AiSummary, type Database, type Locale, type Tender } from "../lib/database.types";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const MODEL = process.env.SUMMARY_MODEL ?? "claude-haiku-5-5";
const MAX_PAGE_CHARS = 12_000;

/**
 * Жёсткий лимит на пункт: ~1–2 коротких предложения. Длиннее — один повторный запрос.
 * Русский текст в среднем длиннее латышского/английского, поэтому лимит чуть выше.
 */
const MAX_POINT_CHARS: Record<Locale, number> = { lv: 220, ru: 250, en: 220 };

/** Подписи пунктов: модель пишет только текст, подписи добавляет код — они всегда одинаковые. */
const LABELS: Record<Locale, [string, string, string]> = {
  lv: ["Būtība", "Budžets un termiņi", "Prasības pretendentam"],
  ru: ["Суть", "Бюджет и сроки", "Требования к участнику"],
  en: ["Summary", "Budget and deadlines", "Bidder requirements"],
};

const PointsSchema = z.object({
  essence: z.string().describe("What is being procured and for whom. 1 short sentence."),
  budget: z
    .string()
    .describe("Estimated contract value, submission deadline (date and time), contract duration. 1–2 short sentences."),
  requirements: z.string().describe("Key requirements or conditions for bidders. 1–2 short sentences."),
});
type Points = z.infer<typeof PointsSchema>;

const TranslatedSchema = PointsSchema.extend({
  title: z.string().describe("The procurement title translated into this language."),
});

/**
 * Ответ модели: строго JSON-объект с тремя языками (гарантируется structured outputs).
 * Латышский заголовок модель не пишет — это оригинал из EIS, его подставляет код без изменений.
 */
const SummarySchema = z.object({ lv: PointsSchema, ru: TranslatedSchema, en: TranslatedSchema });
type Summary = z.infer<typeof SummarySchema>;

const SYSTEM_PROMPT = `You help small businesses in Latvia follow public procurements.
From the procurement data, write a very short summary in THREE languages: Latvian (lv), Russian (ru), English (en).
Each language has the same three points with the same facts:
1) essence, 2) budget and deadlines, 3) key requirements for bidders.
For ru and en, also translate the procurement title ("Nosaukums").

Output: only a JSON object {"lv": {...}, "ru": {...}, "en": {...}} matching the schema — no markdown, no code fences, no extra text.

Title translation rules (ru, en) — the title MUST be translated, never copied:
- Translate every ordinary word of the official title into Russian / English. Never leave Latvian common words
  (e.g. "piegāde", "iegāde", "uzturēšana", "aprīkojums", "skaitītāju") untranslated.
- Only proper names keep their Latin spelling: organizations, companies, places, brands, acronyms
  (e.g. Ropažu novads, LBTU, "RĒZEKNES SLIMNĪCA"). Everything around them is translated.
- Translate the full title accurately; do not shorten it, summarize it or add information. Keep numbers, codes and years.
- Never return an empty title. No trailing period.
Examples:
- "Ropažu novada, Ropažu pagasta autoceļu un ielu ikdienas uzturēšana 2026/2027 gada ziemas periodā"
  → ru "Ежедневное содержание автодорог и улиц Ropažu pagasts (Ropažu novads) в зимний период 2026/2027"
  → en "Daily maintenance of roads and streets in Ropažu parish (Ropažu municipality) during the 2026/2027 winter period"
- "Dronu laboratorijas un datorklases mēbeļu iegāde projekta S567 ietvaros"
  → ru "Закупка мебели для лаборатории дронов и компьютерного класса в рамках проекта S567"

Strict length rules:
- Each point: AT MOST 1–2 short sentences (≤ ${MAX_POINT_CHARS.lv} characters; Russian ≤ ${MAX_POINT_CHARS.ru}).
- Only what helps a company decide whether to bid. No introductions.
- Do not repeat the title, the customer's registration number, CPV codes, the procurement ID or the procedure type.
- Budget: total with currency (e.g. 233 000 EUR); list lots only if there are 2–3.
- Deadline format: lv "24.11.2026 plkst. 09:00", ru "24.11.2026 в 09:00", en "24.11.2026 at 09:00".

Content rules:
- Use only the provided data. Never invent amounts, dates or requirements.
- If information is missing, write: lv "Nav norādīts", ru "Не указано", en "Not specified".
- If the page has no concrete bidder requirements, write one sentence — lv "Prasības — nolikumā (EIS dokumenti).",
  ru "Требования — в положении о закупке (документы EIS).", en "Requirements are in the tender regulations (EIS documents)." —
  plus, if present, one important condition (e.g. award criterion or mandatory site visit).
- Names of organizations, companies, places and brands: copy them EXACTLY as written in the source, in Latin script,
  in all three languages (e.g. "Jūrmalas ūdens" SIA, Iecava, Rēzeknes slimnīca). Never transliterate them into Cyrillic
  and never mix Latin and Cyrillic letters in one word. Translate everything else naturally.`;

/**
 * Слово, в котором смешаны латиница и кириллица («удens», «Иecavской») — признак испорченного имени.
 * Допустимы аббревиатуры через дефис: «IoT-платформы», «ERP-систему».
 */
const MIXED_SCRIPT_WORD = /[\p{Script=Latin}][\p{Script=Cyrillic}]|[\p{Script=Cyrillic}][\p{Script=Latin}]/u;

/** Проблемы, из-за которых стоит один раз переспросить модель. */
/** Латышские буквы с диакритикой — в обычных словах перевода их быть не должно. */
const LATVIAN_DIACRITIC = /[āčēģīķļņšūž]/i;

/**
 * Проверки перевода заголовка (ru/en): не пустой, не копия оригинала, без непереведённых
 * латышских слов. Имена собственные пишутся с заглавной, а названия в кавычках
 * («NVO un brīvprātīgo godināšana») — это имена мероприятий, поэтому их не проверяем.
 */
function titleProblems(locale: "ru" | "en", title: string, original: string): string[] {
  const t = title.trim();
  if (!t) return [`${locale}.title: empty — translate the title`];
  const norm = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  if (norm(t) === norm(original)) return [`${locale}.title: copied from the Latvian original — translate it`];

  const problems: string[] = [];
  const unquoted = t.replace(/[«„“"][^«»„“”"]*[»”"]/g, " ");
  const leftovers = unquoted
    .split(/[\s,.;:()/]+/)
    .filter((w) => w.length >= 3 && /^\p{Ll}/u.test(w) && LATVIAN_DIACRITIC.test(w));
  if (leftovers.length > 0) {
    problems.push(`${locale}.title: untranslated Latvian words ${leftovers.join(", ")} — translate them`);
  }
  if (locale === "ru") {
    const letters = unquoted.match(/\p{L}/gu) ?? [];
    const cyrillic = unquoted.match(/\p{Script=Cyrillic}/gu) ?? [];
    if (letters.length > 0 && cyrillic.length / letters.length < 0.4) {
      problems.push("ru.title: mostly not in Russian — translate everything except proper names");
    }
  }
  return problems;
}

function findProblems(s: Summary, originalTitle: string): string[] {
  const titles = [
    ...titleProblems("ru", s.ru.title, originalTitle),
    ...titleProblems("en", s.en.title, originalTitle),
  ];
  return titles.concat(LOCALES.flatMap((locale) =>
    Object.entries(s[locale]).flatMap(([key, text]) => {
      const problems: string[] = [];
      const len = text.trim().length;
      // лимит длины — только для пунктов выжимки; заголовок переводится полностью
      if (key !== "title" && len > MAX_POINT_CHARS[locale]) {
        problems.push(`${locale}.${key}: too long (${len} chars)`);
      }
      const mixed = text.split(/[\s,.;:()«»"„“]+/).filter((w) => MIXED_SCRIPT_WORD.test(w));
      if (mixed.length > 0) {
        problems.push(`${locale}.${key}: mixed Latin/Cyrillic in ${mixed.join(", ")} — copy names exactly from the source`);
      }
      return problems;
    }),
  ));
}

/** «175000.00 EUR» → «175 000 EUR», «7965,50 EUR» → «7 965,50 EUR» (детерминированно, не полагаемся на модель). */
function formatAmounts(text: string): string {
  return text.replace(/\b(\d{4,})(?:[.,](\d{2}))?(\s?)(EUR|€)/g, (_, int: string, cents: string | undefined, _sp, cur: string) => {
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${grouped}${cents && cents !== "00" ? `,${cents}` : ""} ${cur}`;
  })
    // модель иногда сама группирует разряды, но оставляет копейки: «16 000,00 EUR» → «16 000 EUR»
    .replace(/(\d)[.,]00(\s?)(EUR|€)/g, "$1 $3");
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env.local`);
  return value;
}

function formatPoints(locale: Locale, p: Points): string {
  const [essence, budget, requirements] = LABELS[locale];
  return [
    `• ${essence}: ${formatAmounts(p.essence.trim())}`,
    `• ${budget}: ${formatAmounts(p.budget.trim())}`,
    `• ${requirements}: ${formatAmounts(p.requirements.trim())}`,
  ].join("\n");
}

/**
 * Убираем точку в конце переведённого заголовка. Кавычки не трогаем: в названии
 * может быть закрывающая кавычка имени мероприятия («NVO un brīvprātīgo godināšana»).
 */
function cleanTitle(title: string): string {
  return title.trim().replace(/\.$/, "").trim();
}

function toAiSummary(s: Summary, originalTitle: string): AiSummary {
  return {
    lv: { title: originalTitle, summary: formatPoints("lv", s.lv) },
    ru: { title: cleanTitle(s.ru.title), summary: formatPoints("ru", s.ru) },
    en: { title: cleanTitle(s.en.title), summary: formatPoints("en", s.en) },
  };
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

async function summarize(client: Anthropic, tender: Tender, pageText: string): Promise<AiSummary> {
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

  // Первая попытка + максимум один повтор, если какой-то пункт длиннее лимита.
  // messages.parse + zodOutputFormat: API гарантирует чистый JSON по схеме (без markdown),
  // SDK делает JSON.parse и проверяет результат через Zod → parsed_output.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
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

    const problems = findProblems(response.parsed_output, tender.title);
    if (problems.length === 0 || attempt === 2) {
      if (problems.length > 0) console.warn(`  ! still has problems after retry:\n    ${problems.join("\n    ")}`);
      return toAiSummary(response.parsed_output, tender.title);
    }

    messages.push(
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: `Fix these problems and return the full JSON again:
- ${problems.join("\n- ")}
Each point must stay 1–2 short sentences (lv/en ≤ ${MAX_POINT_CHARS.lv}, ru ≤ ${MAX_POINT_CHARS.ru} characters) and keep all amounts and deadlines.`,
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
        console.log(`\n✓ [${tender.external_id}] ${tender.title}`);
        for (const locale of LOCALES) {
          console.log(`  [${locale}] ${summary[locale].title}\n${summary[locale].summary}`);
        }
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
