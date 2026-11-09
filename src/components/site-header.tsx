"use client";

import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LOCALES } from "@/lib/database.types";
import { LOCALE_LABELS } from "@/lib/i18n";
import { useLocale } from "./locale-provider";
import { Preferences } from "./preferences";

export function SiteHeader() {
  const { locale, setLocale, t } = useLocale();

  return (
    // Glassmorphism: полупрозрачный фон + размытие того, что под шапкой (свечение, текстура, карточки)
    <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_20px_-4px_var(--primary)]">
            <FileSearch className="size-4" aria-hidden />
          </span>
          {/* на узких экранах оставляем только логотип, чтобы поместились переключатели */}
          <span className="hidden truncate font-semibold tracking-tight min-[400px]:inline">{t.appName}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
        <Preferences />
        <div role="group" aria-label={t.language} className="flex shrink-0 items-center gap-1 rounded-lg border bg-background/50 p-0.5">
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
      </div>
    </header>
  );
}
