/**
 * Скрапер свежих закупок с eis.gov.lv (Elektronisko iepirkumu sistēma).
 *
 * Запуск: npm run scrape
 * Требует в .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Структура страницы (проверено 09.11.2026):
 *   вторая table.table → строки tr с 6 td:
 *   [0] статус  [1] дата публикации <br> номер закупки  [2] <a href="/EKEIS/Supplier/ViewProcurement/{id}">название</a>
 *   [3] заказчик (рег. номер)  [4] "Submission deadline: dd.mm.yyyy"  [5] иконка
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import type { Database, TenderInsert } from "../lib/database.types";

const BASE_URL = "https://www.eis.gov.lv";
const LIST_URL = `${BASE_URL}/EKEIS/Supplier/`;
const MAX_TENDERS = 10;

type RawRow = {
  href: string;
  title: string;
  customer: string;
  deadlineText: string;
};

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Смещение Europe/Riga относительно UTC (в минутах) на заданный момент — учитывает летнее время. */
function rigaOffsetMinutes(utcGuess: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Riga",
    timeZoneName: "longOffset",
  }).formatToParts(utcGuess);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+02:00";
  const m = tz.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 120;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * "dd.mm.yyyy" или "dd.mm.yyyy HH:MM" (время по Риге) → ISO-строка UTC.
 * В списке EIS обычно только дата; точное время есть на странице закупки.
 * Если времени нет — берём 23:59 по Риге, чтобы не считать тендер закрытым раньше срока.
 */
function parseDeadline(text: string): string | null {
  const m = text.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh = "23", min = "59"] = m;
  const asUtc = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
  const offset = rigaOffsetMinutes(new Date(asUtc));
  return new Date(asUtc - offset * 60_000).toISOString();
}

async function scrape(): Promise<TenderInsert[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(LIST_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector('table.table a[href*="/ViewProcurement/"]', { timeout: 30_000 });

    const rows: RawRow[] = await page.$$eval("table.table tr", (trs) =>
      trs
        .map((tr) => {
          const tds = tr.querySelectorAll("td");
          const link = tr.querySelector<HTMLAnchorElement>('a[href*="/ViewProcurement/"]');
          if (tds.length < 5 || !link) return null;
          return {
            href: link.getAttribute("href") ?? "",
            title: link.textContent?.trim() ?? "",
            customer: tds[3].textContent?.replace(/\s+/g, " ").trim() ?? "",
            deadlineText: tds[4].textContent?.replace(/\s+/g, " ").trim() ?? "",
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
    );

    return rows
      .map((r): TenderInsert | null => {
        const id = r.href.match(/ViewProcurement\/(\d+)/)?.[1];
        if (!id || !r.title) return null;
        return {
          external_id: id,
          title: r.title,
          customer_name: r.customer || null,
          deadline: parseDeadline(r.deadlineText),
          url: new URL(r.href, BASE_URL).toString(),
        };
      })
      .filter((t): t is TenderInsert => t !== null)
      .slice(0, MAX_TENDERS);
  } finally {
    await browser.close();
  }
}

async function main() {
  const supabase = createAdminClient();

  console.log(`Opening ${LIST_URL} ...`);
  const tenders = await scrape();
  console.log(`Scraped ${tenders.length} tenders`);
  if (tenders.length === 0) {
    throw new Error("No tenders found — page structure may have changed");
  }

  // upsert по external_id: новые вставляются, существующие обновляются (без дублей).
  // ai_summary не передаём, чтобы не затирать уже сгенерированные выжимки.
  const { data, error } = await supabase
    .from("tenders")
    .upsert(tenders, { onConflict: "external_id" })
    .select("external_id, title, deadline");

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);

  const fmt = new Intl.DateTimeFormat("lv-LV", {
    timeZone: "Europe/Riga",
    dateStyle: "short",
    timeStyle: "short",
  });
  console.log(`Saved ${data.length} rows to Supabase:`);
  for (const t of data) {
    const deadline = t.deadline ? fmt.format(new Date(t.deadline)) : "—";
    console.log(`  [${t.external_id}] ${deadline}  ${t.title}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
