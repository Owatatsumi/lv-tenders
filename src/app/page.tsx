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

const BLOB = "absolute rounded-full blur-[120px]";
const BLUE = "bg-primary/25 dark:bg-primary/30";
const ORANGE = "bg-orange-accent/20 dark:bg-orange-accent/25";

/**
 * Свечение по всей высоте страницы: 6 размытых пятен, чередуются Electric Blue / Cantaloupe Orange
 * и левый / правый край. Слой растянут на всю обёртку (inset-0) и обрезан (overflow-hidden),
 * pointer-events-none — не перехватывает клики по карточкам.
 * `isolate` у обёртки держит z-[-10] над фоном body (с текстурой), но под контентом.
 */
function BackgroundGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[-10] overflow-hidden">
      <div className={`${BLOB} ${BLUE} top-[-10%] left-[-10%] size-[34rem]`} />
      <div className={`${BLOB} ${ORANGE} top-[6%] right-[-12%] size-[30rem]`} />
      <div className={`${BLOB} ${ORANGE} top-[28%] left-[-14%] size-[28rem]`} />
      <div className={`${BLOB} ${BLUE} top-[46%] right-[-8%] size-[32rem]`} />
      <div className={`${BLOB} ${BLUE} top-[66%] left-[-8%] size-[30rem]`} />
      <div className={`${BLOB} ${ORANGE} bottom-[-5%] right-[-5%] size-[34rem]`} />
    </div>
  );
}

export default function Home() {
  return (
    <LocaleProvider>
      {/* overflow-clip, а не overflow-hidden: так же обрезает пятна (без горизонтального скролла),
          но не создаёт область прокрутки — иначе перестанет работать sticky-шапка */}
      <div className="relative isolate flex flex-1 flex-col overflow-clip">
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
