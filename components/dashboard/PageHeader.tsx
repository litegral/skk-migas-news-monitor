import type { ReactNode } from "react";

import { SidebarTrigger } from "@/components/dashboard/Sidebar";
import { cx } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: Readonly<PageHeaderProps>) {
  return (
    <header
      className={cx(
        "mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
            {eyebrow}
          </p>
        )}
        <div className="flex items-center gap-2.5">
          <SidebarTrigger />
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-[1.75rem] dark:text-white">
            {title}
          </h1>
        </div>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
