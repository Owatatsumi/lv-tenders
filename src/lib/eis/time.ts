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

/** Локальное время Риги (компоненты даты) → ISO-строка UTC. */
function rigaToUtcIso(y: number, mo: number, d: number, h: number, mi: number): string {
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  return new Date(asUtc - rigaOffsetMinutes(new Date(asUtc)) * 60_000).toISOString();
}

/** "2026-11-13T09:00:00" (время Риги, без зоны — так отдаёт API EIS) → ISO UTC. */
export function parseRigaIso(value: string | null | undefined): string | null {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return rigaToUtcIso(+m[1], +m[2], +m[3], +m[4], +m[5]);
}

/**
 * "dd.mm.yyyy HH:MM" или "dd.mm.yyyy" (время Риги) → ISO UTC.
 * Если времени нет — 23:59 по Риге, чтобы не считать тендер закрытым раньше срока.
 */
export function parseRigaDate(text: string | null | undefined): string | null {
  const m = text?.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  return rigaToUtcIso(+m[3], +m[2], +m[1], m[4] ? +m[4] : 23, m[5] ? +m[5] : 59);
}
