"use client";

import { useLocale } from "./locale-provider";

export function TenderListHeader({ count }: { count?: number }) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t.latest}</h1>
        <p className="text-sm text-muted-foreground">{t.tagline}</p>
      </div>
      {count !== undefined && <p className="text-sm text-muted-foreground">{t.count(count)}</p>}
    </div>
  );
}

export function TenderListMessage({ kind }: { kind: "empty" | "error" }) {
  const { t } = useLocale();
  return (
    <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {kind === "empty" ? t.empty : t.error}
    </p>
  );
}
