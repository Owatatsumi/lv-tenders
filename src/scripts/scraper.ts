/**
 * Скрапер свежих закупок с eis.gov.lv (Elektronisko iepirkumu sistēma).
 *
 * Запуск: npm run scrape
 * Требует в .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * 1. Страница списка (вторая table.table, строки tr с 6 td):
 *    [1] дата публикации <br> номер  [2] <a href="/EKEIS/Supplier/ViewProcurement/{id}">название</a>
 *    [3] заказчик (рег. номер)        [4] срок подачи (только дата)
 * 2. Страница деталей каждого тендера: все разделы уже в HTML (свёрнуты),
 *    поля размечены стабильными label[for=...], не зависящими от языка интерфейса:
 *    - stage_ProposalSubmissionDate   → точный дедлайн "dd.mm.yyyy HH:MM (plānots)"
 *    - SubjectDescription_Description → текстовое описание предмета («Cita informācija»)
 *
 * Детали запрашиваются для всех тендеров из выборки, а не только новых:
 * заказчик может продлить срок подачи, и дедлайн в базе должен это отражать.
 */
import { existsSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import type { Database, TenderInsert } from "../lib/database.types";

const BASE_URL = "https://www.eis.gov.lv";
const LIST_URL = `${BASE_URL}/EKEIS/Supplier/`;
const MAX_TENDERS = 10;
const DELAY_BETWEEN_PAGES_MS = 500; // не нагружаем гос. портал

type ListRow = {
  externalId: string;
  url: string;
  title: string;
  customer: string;
  deadlineText: string;
};

type Details = {
  deadlineText: string;
  description: string;
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
 * "dd.mm.yyyy HH:MM" или "dd.mm.yyyy" (время по Риге) → ISO-строка UTC.
 * Если времени нет — 23:59 по Риге, чтобы не считать тендер закрытым раньше срока.
 */
function parseDeadline(text: string): string | null {
  const m = text.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh = "23", min = "59"] = m;
  const asUtc = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
  const offset = rigaOffsetMinutes(new Date(asUtc));
  return new Date(asUtc - offset * 60_000).toISOString();
}

async function scrapeList(page: Page): Promise<ListRow[]> {
  await page.goto(LIST_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector('table.table a[href*="/ViewProcurement/"]', { timeout: 30_000 });

  const raw = await page.$$eval("table.table tr", (trs) =>
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

  return raw
    .map((r): ListRow | null => {
      const externalId = r.href.match(/ViewProcurement\/(\d+)/)?.[1];
      if (!externalId || !r.title) return null;
      return {
        externalId,
        url: new URL(r.href, BASE_URL).toString(),
        title: r.title,
        customer: r.customer,
        deadlineText: r.deadlineText,
      };
    })
    .filter((r): r is ListRow => r !== null)
    .slice(0, MAX_TENDERS);
}

/**
 * Текст поля по label[for=id]. Внутри evaluate нельзя объявлять именованные функции:
 * tsx (esbuild keepNames) оборачивает их в __name(), которого нет в браузере.
 */
function readField(page: Page, id: string): Promise<string> {
  return page.evaluate((fieldId) => {
    const block = document
      .querySelector(`label[for="${fieldId}"]`)
      ?.closest(".form-group")
      ?.querySelector(".field-block");
    if (!block) return "";
    const clone = block.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("script, style").forEach((el) => el.remove());
    return (clone.innerText || clone.textContent || "")
      .replace(/[ \t ]+/g, " ")
      .replace(/\s*\n\s*/g, "\n")
      .trim();
  }, id);
}

async function scrapeDetails(page: Page, url: string): Promise<Details> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector('label[for="Name"]', { state: "attached", timeout: 30_000 });

  return {
    deadlineText: await readField(page, "stage_ProposalSubmissionDate"),
    description: await readField(page, "SubjectDescription_Description"),
  };
}

async function scrape(): Promise<TenderInsert[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const rows = await scrapeList(page);
    console.log(`Found ${rows.length} tenders on the list page, opening details...`);

    const tenders: TenderInsert[] = [];
    for (const row of rows) {
      await sleep(DELAY_BETWEEN_PAGES_MS);
      let details: Details | null = null;
      try {
        details = await scrapeDetails(page, row.url);
      } catch (err) {
        console.warn(`  ! [${row.externalId}] details failed, using list data: ${String(err)}`);
      }

      const exactDeadline = details ? parseDeadline(details.deadlineText) : null;
      if (details && !exactDeadline) {
        console.warn(`  ! [${row.externalId}] no exact deadline on details page, using list date`);
      }

      tenders.push({
        external_id: row.externalId,
        title: row.title,
        customer_name: row.customer || null,
        deadline: exactDeadline ?? parseDeadline(row.deadlineText),
        url: row.url,
        // при ошибке деталей не передаём поле, чтобы не затереть уже сохранённое описание
        ...(details ? { description: details.description || null } : {}),
      });
    }
    return tenders;
  } finally {
    await browser.close();
  }
}

async function main() {
  const supabase = createAdminClient();

  console.log(`Opening ${LIST_URL} ...`);
  const tenders = await scrape();
  if (tenders.length === 0) {
    throw new Error("No tenders found — page structure may have changed");
  }

  // upsert по external_id: новые вставляются, существующие обновляются (без дублей).
  // ai_summary не передаём, чтобы не затирать уже сгенерированные выжимки.
  const { data, error } = await supabase
    .from("tenders")
    .upsert(tenders, { onConflict: "external_id" })
    .select("external_id, title, deadline, description");

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);

  const fmt = new Intl.DateTimeFormat("lv-LV", {
    timeZone: "Europe/Riga",
    dateStyle: "short",
    timeStyle: "short",
  });
  console.log(`Saved ${data.length} rows to Supabase:`);
  for (const t of data) {
    const deadline = t.deadline ? fmt.format(new Date(t.deadline)) : "—";
    const desc = t.description ? `desc ${t.description.length} chars` : "no desc";
    console.log(`  [${t.external_id}] ${deadline}  (${desc})  ${t.title}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
