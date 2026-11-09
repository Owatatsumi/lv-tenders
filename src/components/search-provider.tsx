"use client";

import { createContext, useContext, useTransition, type ReactNode, type TransitionStartFunction } from "react";

type SearchContextValue = { isSearching: boolean; startSearch: TransitionStartFunction };

const SearchContext = createContext<SearchContextValue | null>(null);

/**
 * Общий transition для поиска: строка поиска запускает навигацию (?q=…) внутри него,
 * а список результатов по isSearching показывает, что идёт загрузка.
 */
export function SearchProvider({ children }: { children: ReactNode }) {
  const [isSearching, startSearch] = useTransition();
  return <SearchContext.Provider value={{ isSearching, startSearch }}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used inside <SearchProvider>");
  return ctx;
}
