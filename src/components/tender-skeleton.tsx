import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const TENDER_GRID = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";

export function TenderCardSkeleton() {
  return (
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
  );
}

export function TenderGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className={TENDER_GRID} aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <TenderCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
