"use client";

import { Loader2, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "./locale-provider";
import { useSearch } from "./search-provider";

const DEBOUNCE_MS = 350;

/**
 * Строка поиска. Запрос хранится в URL (?q=…): результатами можно поделиться,
 * а «Назад» в браузере возвращает предыдущий поиск. Ввод с задержкой 350 мс,
 * чтобы не дёргать сервер на каждую букву.
 */
export function SearchBar() {
  const { t } = useLocale();
  const { isSearching, startSearch } = useSearch();
  const router = useRouter();
  const pathname = usePathname();
  const urlQuery = useSearchParams().get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function navigate(next: string) {
    const q = next.trim();
    if (q === urlQuery) return;
    startSearch(() => {
      router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false });
    });
  }

  function onChange(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate(next), DEBOUNCE_MS);
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        clearTimeout(timer.current);
        navigate(value);
      }}
      className="relative"
    >
      <label htmlFor="tender-search" className="sr-only">
        {t.search}
      </label>
      <Search
        aria-hidden
        // z-10: backdrop-blur у поля создаёт свой слой и иначе перекрывает иконку
        className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id="tender-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.searchPlaceholder}
        autoComplete="off"
        enterKeyHint="search"
        className="h-14 rounded-2xl bg-card/70 pr-24 pl-12 text-base shadow-[0_0_40px_-16px_var(--primary)] backdrop-blur-md md:text-base [&::-webkit-search-cancel-button]:hidden"
      />
      <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1">
        {isSearching && <Loader2 aria-label={t.loading} className="size-5 animate-spin text-primary" />}
        {value && (
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t.clearSearch} onClick={() => onChange("")}>
            <X aria-hidden />
          </Button>
        )}
      </div>
    </form>
  );
}

export function SearchBarSkeleton() {
  return <div className="h-14 rounded-2xl border bg-card/70 backdrop-blur-md" aria-hidden />;
}
