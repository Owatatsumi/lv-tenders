import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { TenderCard } from "@/components/tender-card";
import { TenderListHeader, TenderListMessage } from "@/components/tender-list-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUserId } from "@/lib/supabase-server";
import { getLatestTenders } from "@/lib/tenders";

const GRID = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";

/**
 * Серверный компонент: свежие данные на каждый запрос, стримятся внутри <Suspense>.
 * Читает сессию из cookies — гостю выжимки не отправляются (paywall на сервере).
 */
async function TenderGrid() {
  let tenders;
  try {
    const authenticated = (await getCurrentUserId()) !== null;
    tenders = await getLatestTenders({ authenticated, limit: 20 });
  } catch (err) {
    // cookies() при пререндере бросает служебную ошибку Next.js — её нельзя глотать
    unstable_rethrow(err);
    console.error(err);
    return <TenderListMessage kind="error" />;
  }

  if (tenders.length === 0) return <TenderListMessage kind="empty" />;

  return (
    <ul className={GRID}>
      {tenders.map((tender) => (
        <li key={tender.id}>
          <TenderCard tender={tender} />
        </li>
      ))}
    </ul>
  );
}

function TenderGridSkeleton() {
  return (
    <ul className={GRID} aria-busy="true">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i}>
          <Card className="h-full bg-card/70 backdrop-blur-md">
            <CardHeader className="gap-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-28 w-full" />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <TenderListHeader />
      <Suspense fallback={<TenderGridSkeleton />}>
        <TenderGrid />
      </Suspense>
    </main>
  );
}
