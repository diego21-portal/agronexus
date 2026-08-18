export function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gray-200 ${className}`}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <Skeleton className="h-52 w-full rounded-none" />

      <div className="space-y-4 p-5">
        <Skeleton className="h-4 w-24" />

        <Skeleton className="h-6 w-4/5" />

        <Skeleton className="h-4 w-full" />

        <Skeleton className="h-7 w-32" />

        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}