import { Suspense } from "react";
import { LocaleProvider } from "@/components/locale-provider";
import { SiteHeader } from "@/components/site-header";
import { TenderCard } from "@/components/tender-card";
import { TenderListHeader, TenderListMessage } from "@/components/tender-list-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getLatestTenders } from "@/lib/tenders";

const GRID = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";

/** Серверный компонент: свежие данные на каждый запрос, стримятся внутри <Suspense>. */
async function TenderGrid() {
  let tenders;
  try {
    tenders = await getLatestTenders(20);
  } catch (err) {
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

/**
 * Мягкое свечение в верхних углах: два размытых пятна под контентом.
 * `isolate` у обёртки страницы держит z-[-10] над фоном body (с текстурой), но под контентом.
 */
function BackgroundGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[-10] h-[44rem] overflow-hidden">
      <div className="absolute -top-48 -left-40 size-[34rem] rounded-full bg-primary/25 blur-[120px] dark:bg-primary/30" />
      <div className="absolute -top-32 -right-48 size-[30rem] rounded-full bg-orange-accent/20 blur-[120px] dark:bg-orange-accent/25" />
    </div>
  );
}

export default function Home() {
  return (
    <LocaleProvider>
      <div className="relative isolate flex flex-1 flex-col">
        <BackgroundGlow />
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
          <TenderListHeader />
          <Suspense fallback={<TenderGridSkeleton />}>
            <TenderGrid />
          </Suspense>
        </main>
      </div>
    </LocaleProvider>
  );
}
