import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SearchBar, SearchBarSkeleton } from "@/components/search-bar";
import { SearchProvider } from "@/components/search-provider";
import { TenderListHeader, TenderListMessage } from "@/components/tender-list-header";
import { TenderResults } from "@/components/tender-results";
import { TenderGridSkeleton } from "@/components/tender-skeleton";
import { getCurrentUserId } from "@/lib/supabase-server";
import { parseQuery, searchTenders } from "@/lib/tenders";

/**
 * Серверный компонент: первая страница результатов на каждый запрос, стримится внутри <Suspense>.
 * Читает ?q=… и сессию из cookies — гостю текст сводок не отправляется (paywall на сервере).
 */
async function TenderGrid({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  // Список персональный (сессия) и всегда свежий — рендерим только во время запроса.
  // Без этого Next.js пытается пререндерить блок, а клиент Supabase проверяет срок токена
  // через Date.now() → ошибка «unstable value Date.now() while prerendering» у авторизованных.
  await connection();
  const { q } = await searchParams;
  const query = parseQuery(typeof q === "string" ? q : "").join(" ");

  let page;
  try {
    const authenticated = (await getCurrentUserId()) !== null;
    page = await searchTenders({ authenticated, query });
  } catch (err) {
    // cookies() при пререндере бросает служебную ошибку Next.js — её нельзя глотать
    unstable_rethrow(err);
    console.error(err);
    return <TenderListMessage kind="error" />;
  }

  // key: новый запрос — новый список (сбрасываем подгруженные страницы)
  return <TenderResults key={query} initial={page} query={query} />;
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <TenderListHeader />
      <SearchProvider>
        {/* SearchBar читает ?q через useSearchParams — это данные запроса, нужен Suspense */}
        <Suspense fallback={<SearchBarSkeleton />}>
          <SearchBar />
        </Suspense>
        <Suspense fallback={<TenderGridSkeleton />}>
          <TenderGrid searchParams={searchParams} />
        </Suspense>
      </SearchProvider>
    </main>
  );
}
