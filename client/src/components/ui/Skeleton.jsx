export function Skeleton({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-control bg-ink/10 motion-reduce:animate-none ${className}`}
    />
  );
}

export function SkeletonRows({ n = 5, className = 'h-14' }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </div>
  );
}

export function FullPageSkeleton() {
  return (
    <div className="min-h-dvh p-6" role="status" aria-label="Loading">
      <Skeleton className="mb-6 h-10 w-48" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="mt-6 h-64" />
    </div>
  );
}
