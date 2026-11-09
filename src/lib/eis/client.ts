/**
 * Клиент EIS (eis.gov.lv) на обычных HTTP-запросах — без браузера, поэтому работает
 * и из CLI-скриптов, и в serverless-функциях Vercel (там Playwright/Chromium недоступен).
 *
 * Список закупок: тот же JSON-эндпоинт, что дёргает сайт при пагинации
 *   POST /EKEIS/supplier/searchprocurements  { From: 0 | 20 | 40 … }
 * Сайт защищает его CSRF-токеном и проверкой Origin, поэтому сначала открываем страницу
 * списка, берём токен из HTML и cookies из ответа (EisSession).
 *
 * Страница закупки: обычный HTML, все разделы уже в разметке; поля размечены стабильными
 * label[for=…], которые не зависят от языка интерфейса.
 */
import * as cheerio from "cheerio";
import { parseRigaDate, parseRigaIso } from "./time";

export const EIS_BASE = "https://www.eis.gov.lv";
const LIST_URL = `${EIS_BASE}/EKEIS/Supplier/`;
const SEARCH_URL = `${EIS_BASE}/EKEIS/supplier/searchprocurements`;
/** Столько записей EIS отдаёт за одну «страницу» списка. */
export const EIS_PAGE_SIZE = 20;
const USER_AGENT = "Mozilla/5.0 (compatible; lv-tenders/0.1; +public procurement digest)";
const TIMEOUT_MS = 30_000;
/** Сколько текста страницы закупки отдаём модели (≈ 3–4 тыс. токенов). */
const MAX_PAGE_TEXT = 12_000;

export type EisListItem = {
  externalId: string;
  title: string;
  customer: string | null;
  /** точный срок подачи, ISO UTC */
  deadline: string | null;
  url: string;
  announcedAt: string | null;
};

export type EisDetails = {
  /** «Cita informācija» — свободное описание предмета закупки (часто пустое) */
  description: string | null;
  /** точный срок подачи со страницы закупки (запасной вариант, если в списке его нет) */
  deadline: string | null;
  /** текст всех разделов страницы «Поле: значение» — источник для AI-сводки */
  pageText: string;
};

export type EisSession = { token: string; cookie: string };

export function tenderUrl(externalId: string): string {
  return `${EIS_BASE}/EKEIS/Supplier/ViewProcurement/${externalId}`;
}

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...init.headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`EIS ${res.status} ${res.statusText} for ${url}`);
  return res;
}

/** Открывает страницу списка: CSRF-токен из HTML + cookies сессии. */
export async function openEisSession(): Promise<EisSession> {
  const res = await request(LIST_URL);
  const html = await res.text();
  const token = cheerio.load(html)('input[name="__RequestVerificationToken"]').attr("value");
  if (!token) throw new Error("EIS: CSRF token not found on the list page — layout may have changed");
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { token, cookie };
}

type RawListItem = {
  Id: number;
  ProcurementTitle: string | null;
  CustomerTitle: string | null;
  CustomerInfo: string | null;
  LastStagePlannedProposalSubmissionTime: string | null;
  Dates: string | null;
  ProcurementAnnouncementDate: string | null;
};

/** Страница списка (pageIndex с 0), новые закупки сверху — как на сайте. */
export async function fetchListPage(session: EisSession, pageIndex: number): Promise<EisListItem[]> {
  const res = await request(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Requested-With": "XMLHttpRequest",
      __RequestVerificationToken: session.token,
      Cookie: session.cookie,
      // EIS сверяет адрес, с которого пришёл POST
      Origin: EIS_BASE,
      Referer: LIST_URL,
    },
    body: JSON.stringify({
      ListMode: 0,
      Paging: true,
      FormCode: "SUP.S01",
      From: pageIndex * EIS_PAGE_SIZE,
      SearchParameters: {
        Mode: 1,
        SearchEventCode: "SUP.810",
        AdvancedSearch: false,
        IsDynamicProcurementSystemHasBeenApplied: 1,
        IsDynamicProcurementSystemHasNotBeenApplied: 0,
        From: 0,
      },
    }),
  });

  const json = (await res.json()) as { Success: boolean; RedirectUrl?: string; EventData?: { Items?: RawListItem[] } };
  if (!json.Success) {
    const reason = json.RedirectUrl ? decodeURIComponent(json.RedirectUrl.split("message=")[1] ?? "") : "unknown";
    throw new Error(`EIS list request failed: ${reason}`);
  }

  return (json.EventData?.Items ?? [])
    .filter((i) => i.Id && i.ProcurementTitle)
    .map((i) => {
      const externalId = String(i.Id);
      return {
        externalId,
        title: i.ProcurementTitle!.trim(),
        customer: (i.CustomerInfo ?? i.CustomerTitle)?.replace(/\s+/g, " ").trim() || null,
        deadline: parseRigaIso(i.LastStagePlannedProposalSubmissionTime) ?? parseRigaDate(i.Dates),
        url: tenderUrl(externalId),
        announcedAt: parseRigaIso(i.ProcurementAnnouncementDate),
      };
    });
}

/** Поля, которые не нужны ни в описании, ни модели (контактное лицо заказчика — персональные данные). */
const SKIP_FIELDS = new Set(["ContactList", "SubjectDescription_CpvAdditionalIdList", "Beneficiaries"]);

/**
 * Таблицы «Части закупки» и «Документы» сайт дорисовывает JavaScript'ом из переменных
 * вида `var Parts_items = [...]` прямо в HTML. Достаём JSON-массив по балансу скобок.
 */
function extractJsonArray<T>(html: string, varName: string): T[] {
  const start = html.indexOf(`var ${varName} = [`);
  if (start < 0) return [];
  let i = html.indexOf("[", start);
  const from = i;
  let depth = 0;
  let inString = false;
  for (; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  try {
    return JSON.parse(html.slice(from, i + 1)) as T[];
  } catch {
    return [];
  }
}

type RawPart = { Title?: string; FormattedEstimatedContractPrice?: string; FormattedContractDuration?: string };
type RawDocument = { Title?: string; TypeTitle?: string };

/** Страница закупки: описание, точный срок и текст всех разделов для AI. */
export async function fetchTenderDetails(externalId: string): Promise<EisDetails> {
  const html = await (await request(`${EIS_BASE}/EKEIS/Supplier/Procurement/${externalId}`)).text();
  const parts = extractJsonArray<RawPart>(html, "Parts_items");
  const documents = extractJsonArray<RawDocument>(html, "ActualDocuments_items");
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const clean = (s: string) => s.replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();

  const fields: { id: string; label: string; value: string }[] = [];
  $("label[for]").each((_, el) => {
    const id = $(el).attr("for") ?? "";
    // у подписи бывает всплывающая подсказка — берём только собственный текст label
    const label = clean($(el).contents().filter((__, n) => n.type === "text").text()).replace(/:$/, "");
    const value = clean($(el).closest(".form-group").find(".field-block").first().text());
    if (id && label && value) fields.push({ id, label, value });
  });

  const field = (id: string) => fields.find((f) => f.id === id)?.value ?? null;

  // Таблицы: части закупки (лоты с ценами) и список документов
  const tables: string[] = [];
  $("table").each((_, table) => {
    const rows = $(table)
      .find("tr")
      .map((__, tr) =>
        $(tr)
          .find("th, td")
          .map((___, td) => clean($(td).text()))
          .get()
          .filter(Boolean)
          .join(" | "),
      )
      .get()
      .filter(Boolean);
    if (rows.length > 1) tables.push(rows.join("\n"));
  });

  const lots = parts.map(
    (p, n) =>
      `Lot ${n + 1}: ${p.Title ?? "?"} | ${p.FormattedEstimatedContractPrice ?? "-"} | ${p.FormattedContractDuration ?? "-"}`,
  );
  const docs = documents.map((d) => d.Title).filter(Boolean);

  const pageText = [
    ...fields.filter((f) => !SKIP_FIELDS.has(f.id)).map((f) => `${f.label}: ${f.value}`),
    ...(lots.length ? ["Lots (title | expected price | duration):", ...lots] : []),
    ...(docs.length ? [`Documents: ${docs.join("; ")}`] : []),
    ...tables,
  ]
    .join("\n")
    .slice(0, MAX_PAGE_TEXT);

  return {
    description: field("SubjectDescription_Description"),
    deadline: parseRigaDate(field("stage_ProposalSubmissionDate")),
    pageText,
  };
}
