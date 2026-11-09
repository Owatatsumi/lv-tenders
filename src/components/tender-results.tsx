"use client";

import { SearchX } from "lucide-react";
import { useState, useTransition } from "react";
import { loadMoreTenders } from "@/app/tenders-actions";
import { Button } from "@/components/ui/button";
import type { TenderPage } from "@/lib/tenders";
import { cn } from "@/lib/utils";
import { useLocale } from "./locale-provider";
import { useSearch } from "./search-provider";
import { TenderCard } from "./tender-card";
import { TENDER_GRID, TenderCardSkeleton } from "./tender-skeleton";

/** Сколько скелетонов показываем при подгрузке (по числу ожидаемых карточек, но не больше 6). */
const LOADING_PLACEHOLDERS = 6;

/**
 * Результаты поиска с кнопкой «Загрузить ещё». Первая страница приходит с сервера;
 * следующие — через server action и дописываются в конец списка.
 * Для нового запроса компонент пересоздаётся (key={query}), поэтому состояние не смешивается.
 */
export function TenderResults({ initial, query }: { initial: TenderPage; query: string }) {
  const { t } = useLocale();
  const { isSearching } = useSearch();
  const [items, setItems] = useState(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [failed, setFailed] = useState(false);
  const [loadingMore, startLoading] = useTransition();

  function loadMore() {
    setFailed(false);
    startLoading(async () => {
      try {
        const page = await loadMoreTenders(query, items.length);
        // защита от дублей, если между запросами появились новые тендеры
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...page.items.filter((i) => !seen.has(i.id))];
        });
        setTotal(page.total);
        setHasMore(page.hasMore);
      } catch {
        setFailed(true);
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">
        <SearchX className="size-6" aria-hidden />
        {query ? t.noResults(query) : t.empty}
      </div>
    );
  }

  const skeletons = Math.min(LOADING_PLACEHOLDERS, total - items.length);

  return (
    <div
      aria-busy={isSearching || loadingMore}
      className={cn("flex flex-col gap-6 transition-opacity", isSearching && "pointer-events-none opacity-50")}
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {query ? t.found(total) : t.count(total)}
      </p>

      <ul className={TENDER_GRID}>
        {items.map((tender) => (
          <li key={tender.id}>
            <TenderCard tender={tender} />
          </li>
        ))}
        {loadingMore &&
          Array.from({ length: skeletons }, (_, i) => (
            <li key={`skeleton-${i}`} aria-hidden>
              <TenderCardSkeleton />
            </li>
          ))}
      </ul>

      <div className="flex flex-col items-center gap-2">
        <p className="text-xs text-muted-foreground">{t.shown(items.length, total)}</p>
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {t.error}
          </p>
        )}
        {hasMore && (
          <Button size="lg" variant="outline" onClick={loadMore} disabled={loadingMore} className="min-w-48 bg-card/70 backdrop-blur-md">
            {loadingMore ? t.loading : t.loadMore}
          </Button>
        )}
      </div>
    </div>
  );
}
