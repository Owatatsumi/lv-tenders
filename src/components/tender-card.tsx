"use client";

import { Building2, CalendarClock, ExternalLink } from "lucide-react";
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

export function TenderCard({ tender }: { tender: TenderListItem }) {
  const { locale, t } = useLocale();
  const localized = tender.ai_summary?.[locale];
  // Заголовок — из AI-JSON на выбранном языке; пока выжимки нет — оригинал из EIS
  const title = localized?.title ?? tender.title;
  const isTranslated = title !== tender.title;
  const lines = localized ? parseSummaryLines(localized.summary) : [];

  return (
    <Card className="h-full">
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
        {lines.length > 0 ? (
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
