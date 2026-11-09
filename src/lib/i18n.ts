import type { Locale } from "./database.types";

export const DEFAULT_LOCALE: Locale = "lv";

export const LOCALE_LABELS: Record<Locale, string> = { lv: "LV", ru: "RU", en: "EN" };

/** Тексты интерфейса. Заказчик остаётся на латышском (как в EIS), название переводится AI. */
export const dictionary = {
  lv: {
    appName: "LV Tenders",
    tagline: "Jaunākie publiskie iepirkumi ar AI kopsavilkumu",
    latest: "Jaunākie iepirkumi",
    count: (n: number) => `${n} iepirkumi`,
    customer: "Pasūtītājs",
    originalTitle: "Oriģinālais nosaukums",
    deadline: "Iesniegšanas termiņš",
    noDeadline: "Termiņš nav norādīts",
    summaryPending: "AI kopsavilkums vēl tiek gatavots.",
    openInEis: "Atvērt EIS",
    empty: "Pagaidām nav neviena iepirkuma.",
    error: "Neizdevās ielādēt iepirkumus. Mēģiniet vēlāk.",
    language: "Valoda",
  },
  ru: {
    appName: "LV Tenders",
    tagline: "Свежие госзакупки Латвии с AI-выжимкой",
    latest: "Последние закупки",
    count: (n: number) => `Закупок: ${n}`,
    customer: "Заказчик",
    originalTitle: "Оригинальное название",
    deadline: "Срок подачи",
    noDeadline: "Срок не указан",
    summaryPending: "AI-выжимка ещё готовится.",
    openInEis: "Открыть в EIS",
    empty: "Пока нет ни одной закупки.",
    error: "Не удалось загрузить закупки. Попробуйте позже.",
    language: "Язык",
  },
  en: {
    appName: "LV Tenders",
    tagline: "Latest Latvian public tenders with AI summaries",
    latest: "Latest tenders",
    count: (n: number) => `${n} tenders`,
    customer: "Contracting authority",
    originalTitle: "Original title",
    deadline: "Submission deadline",
    noDeadline: "No deadline specified",
    summaryPending: "AI summary is being prepared.",
    openInEis: "Open in EIS",
    empty: "No tenders yet.",
    error: "Could not load tenders. Please try again later.",
    language: "Language",
  },
} satisfies Record<Locale, Record<string, string | ((n: number) => string)>>;

export type Dictionary = (typeof dictionary)[Locale];

/**
 * Дедлайн по рижскому времени: "24.11.2026 09:00".
 * Числовой формат собираем из частей вручную — одинаковый результат на сервере (Node)
 * и в браузере, без расхождений при гидрации.
 */
export function formatDeadline(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`;
}

/** "• Būtība: текст" → { label: "Būtība", text: "текст" } */
export function parseSummaryLines(summary: string): { label: string | null; text: string }[] {
  return summary
    .split("\n")
    .map((line) => line.replace(/^•\s*/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([^:]{1,40}):\s*(.+)$/);
      return m ? { label: m[1], text: m[2] } : { label: null, text: line };
    });
}
