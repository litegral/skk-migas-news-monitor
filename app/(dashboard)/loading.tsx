function SkeletonBlock({ className }: Readonly<{ className: string }>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200 dark:bg-gray-800 ${className}`}
      aria-hidden="true"
    />
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <span className="sr-only">Memuat dashboard...</span>

      <div className="space-y-2">
        <SkeletonBlock className="h-8 w-48" />
        <SkeletonBlock className="h-4 w-80 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SkeletonBlock className="h-28 w-full" />
        <SkeletonBlock className="h-28 w-full" />
        <SkeletonBlock className="h-28 w-full" />
        <SkeletonBlock className="h-28 w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SkeletonBlock className="h-80 w-full" />
        <SkeletonBlock className="h-80 w-full" />
      </div>

      <SkeletonBlock className="h-96 w-full" />
    </div>
  );
}
