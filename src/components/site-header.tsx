"use client";

import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LOCALES } from "@/lib/database.types";
import { LOCALE_LABELS } from "@/lib/i18n";
import { useLocale } from "./locale-provider";

export function SiteHeader() {
  const { locale, setLocale, t } = useLocale();

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileSearch className="size-4" aria-hidden />
          </span>
          <span className="truncate font-semibold tracking-tight">{t.appName}</span>
        </div>

        <div role="group" aria-label={t.language} className="flex shrink-0 items-center gap-1 rounded-lg border p-0.5">
          {LOCALES.map((l) => (
            <Button
              key={l}
              size="sm"
              variant={l === locale ? "default" : "ghost"}
              aria-pressed={l === locale}
              onClick={() => setLocale(l)}
              className="h-7 min-w-9 px-2"
            >
              {LOCALE_LABELS[l]}
            </Button>
          ))}
        </div>
      </div>
    </header>
  );
}
