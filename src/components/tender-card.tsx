"use client";

import { Building2, CalendarClock, ExternalLink, Lock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDeadline, parseSummaryLines } from "@/lib/i18n";
import type { TenderListItem } from "@/lib/tenders";
import { useLocale } from "./locale-provider";

/** Заказчик в EIS приходит как «Название (рег. номер)» — номер в карточке не нужен. */
function cleanCustomer(name: string): string {
  return name.replace(/\s*\(\d{8,}\)\s*$/, "");
}

/** Рыба для размытого превью: настоящий текст выжимки гостю не отправляется. */
const PLACEHOLDER = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.",
  "Ut enim ad minim veniam 000 000 EUR; quis nostrud 00.00.0000 exercitation ullamco laboris.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla.",
];

/** Paywall: размытое превью выжимки + плашка с призывом зарегистрироваться. */
function LockedSummary() {
  const { t } = useLocale();
  return (
    <div className="relative">
      <ul aria-hidden className="pointer-events-none space-y-2 rounded-lg bg-muted/50 p-3 text-sm leading-relaxed blur-sm select-none">
        {t.summaryLabels.map((label, i) => (
          <li key={label}>
            <span className="font-medium text-foreground">{label}: </span>
            <span className="text-muted-foreground">{PLACEHOLDER[i]}</span>
          </li>
        ))}
      </ul>
      <div className="absolute inset-0 flex items-center justify-center p-3">
        <div className="flex max-w-xs flex-col items-center gap-3 rounded-xl border bg-background/75 px-4 py-3 text-center shadow-lg backdrop-blur-md">
          <p className="flex items-start gap-2 text-sm font-medium">
            <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {t.paywall}
          </p>
          <Link
            href="/signup"
            className={buttonVariants({ size: "sm", className: "shadow-[0_0_20px_-6px_var(--primary)]" })}
          >
            {t.paywallCta}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function TenderCard({ tender }: { tender: TenderListItem }) {
  const { locale, t } = useLocale();
  const localized = tender.localized?.[locale];
  // Заголовок — из AI-JSON на выбранном языке; пока выжимки нет — оригинал из EIS
  const title = localized?.title ?? tender.title;
  const isTranslated = title !== tender.title;
  // summary === null: выжимка есть, но сервер скрыл её от гостя
  const locked = localized !== undefined && localized.summary === null;
  const lines = localized?.summary ? parseSummaryLines(localized.summary) : [];

  return (
    // Glassmorphism: полупрозрачная карточка размывает свечение и текстуру под собой
    <Card className="h-full bg-card/70 backdrop-blur-md">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={tender.deadline ? "orange" : "outline"} className="gap-1">
            <CalendarClock aria-hidden />
            <span className="sr-only">{t.deadline}: </span>
            {tender.deadline ? formatDeadline(tender.deadline) : t.noDeadline}
          </Badge>
          <Badge variant="outline" className="font-mono text-muted-foreground">
            #{tender.external_id}
          </Badge>
        </div>
        <CardTitle className="text-base leading-snug sm:text-lg" lang={isTranslated ? locale : "lv"}>
          {title}
        </CardTitle>
        {isTranslated && (
          // официальное название на латышском — по нему закупку ищут в EIS и в документах
          <p className="text-xs leading-snug text-muted-foreground" lang="lv">
            <span className="sr-only">{t.originalTitle}: </span>
            {tender.title}
          </p>
        )}
        {tender.customer_name && (
          <CardDescription className="flex items-start gap-1.5">
            <Building2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="sr-only">{t.customer}: </span>
              {cleanCustomer(tender.customer_name)}
            </span>
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-1">
        {locked ? (
          <LockedSummary />
        ) : lines.length > 0 ? (
          <ul className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm leading-relaxed" lang={locale}>
            {lines.map((line, i) => (
              <li key={i}>
                {line.label && <span className="font-medium text-foreground">{line.label}: </span>}
                <span className="text-muted-foreground">{line.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{t.summaryPending}</p>
        )}
      </CardContent>

      <CardFooter className="border-t pt-(--card-spacing) pb-(--card-spacing)">
        <a
          href={tender.url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ size: "sm", className: "w-full sm:w-auto" })}
        >
          {t.openInEis}
          <ExternalLink data-icon="inline-end" aria-hidden />
        </a>
      </CardFooter>
    </Card>
  );
}
