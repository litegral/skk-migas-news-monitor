import { RiLoader4Line } from "@remixicon/react";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RiLoader4Line className="size-4 animate-spin text-primary" aria-hidden="true" />
        Menyiapkan dashboard...
      </div>
    </div>
  );
}
