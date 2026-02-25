"use client";

/**
 * DashboardClient is the client-side component that renders the dashboard UI.
 * Now acts as a shell for Server Components, managing the layout state and period routing.
 */

import React, { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  RiSettings3Line,
  RiEditLine,
  RiCheckLine,
  RiRefreshLine,
  RiLoader4Line
} from "@remixicon/react";

import type { Article } from "@/lib/types/news";
import type { DashboardPeriod } from "@/lib/types/dashboard";
import { PERIOD_OPTIONS } from "@/lib/types/dashboard";
import type { DashboardLayout } from "@/lib/types/dashboard-layout";
import {
  loadDashboardLayout,
  saveDashboardLayout,
  resetDashboardLayout,
} from "@/lib/utils/dashboardLayout";

// UI components
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Card } from "@/components/ui/Card";
import { cx } from "@/lib/utils";

// Dashboard components
import { WidgetGrid } from "@/components/dashboard/WidgetGrid";
import { SyncButton } from "@/components/dashboard/SyncButton";
import { SyncStatusIndicator } from "@/components/dashboard/SyncStatusIndicator";
import { ArticleFeed } from "@/components/news/ArticleFeed";

interface DashboardClientProps {
  widgets: Record<string, React.ReactNode>;
  period: DashboardPeriod;
  topicMap: Record<string, string>;
  availableTopics: string[];
  failedCount: number;
  pendingCount: number;
  decodePendingCount: number;
  initialArticles: Article[];
  totalArticles: number;
}

export function DashboardClient({
  widgets,
  period,
  topicMap,
  availableTopics,
  failedCount,
  pendingCount,
  decodePendingCount,
  initialArticles,
  totalArticles
}: Readonly<DashboardClientProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Dashboard layout state (loaded from localStorage)
  const [layout, setLayout] = React.useState<DashboardLayout>(() =>
    loadDashboardLayout()
  );

  // Edit mode state (default: off, resets on page refresh)
  const [isEditMode, setIsEditMode] = React.useState(false);

  // Handle period change via Next.js router
  const handlePeriodChange = (newPeriod: DashboardPeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", newPeriod);

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  // Handle layout changes - save to localStorage
  const handleLayoutChange = React.useCallback((newLayout: DashboardLayout) => {
    setLayout(newLayout);
    saveDashboardLayout(newLayout);
  }, []);

  // Handle reset layout
  const handleResetLayout = React.useCallback(() => {
    const defaultLayout = resetDashboardLayout();
    setLayout(defaultLayout);
  }, []);

  // Render widget by ID looking up the widgets dict prop
  const renderWidget = React.useCallback(
    (id: string) => {
      // Map grid string IDs to widget Dictionary keys
      const mapping: Record<string, string> = {
        "kpi-total": "kpiTotal",
        "kpi-positive": "kpiPositive",
        "kpi-negative": "kpiNegative",
        "kpi-neutral": "kpiNeutral",
        "sentiment-timeline": "sentimentTimeline",
        "sentiment-pie": "sentimentPie",
        "sources": "sources",
        "categories": "categories"
      };

      const key = mapping[id];
      if (key && widgets[key]) {
        return widgets[key];
      }
      return null;
    },
    [widgets]
  );

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
            Dashboard
            {isPending && <RiLoader4Line className="size-5 animate-spin text-blue-500" />}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Pemantauan berita untuk SKK Migas Kalsul.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SyncButton
            failedCount={failedCount}
            pendingCount={pendingCount}
            decodePendingCount={decodePendingCount}
            totalArticles={totalArticles}
          />
          <SyncStatusIndicator />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION: Ringkasan (Period-dependent data)
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className={cx("transition-opacity duration-300", isPending && "opacity-60")}>
        {/* Section header with settings and period selector */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
              Ringkasan
            </h2>
            {/* Settings dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cx(
                    "rounded-md p-1.5 transition-colors",
                    "text-gray-400 hover:bg-gray-100 hover:text-gray-600",
                    "dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                    isEditMode && "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
                  )}
                  title="Layout settings"
                >
                  <RiSettings3Line className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {isEditMode ? (
                  <DropdownMenuItem onClick={() => setIsEditMode(false)}>
                    <RiCheckLine className="mr-2 size-4" />
                    Done Editing
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setIsEditMode(true)}>
                    <RiEditLine className="mr-2 size-4" />
                    Edit Layout
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleResetLayout}>
                  <RiRefreshLine className="mr-2 size-4" />
                  Reset Layout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Periode:
            </span>
            <Select value={period} onValueChange={(v) => handlePeriodChange(v as DashboardPeriod)} disabled={isPending}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Draggable widget grid */}
        <WidgetGrid
          layout={layout}
          onLayoutChange={handleLayoutChange}
          renderWidget={renderWidget}
          isEditMode={isEditMode}
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION: Artikel Terbaru (Independent of period)
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="mt-10">
        {/* Section header */}
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            Artikel Terbaru
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Berita terbaru dari semua sumber
          </p>
        </div>

        {/* Article Feed with its own filters */}
        <Card>
          <ArticleFeed
            initialArticles={initialArticles}
            totalArticles={totalArticles}
            topicMap={topicMap}
            availableTopics={availableTopics}
          />
        </Card>
      </section>
    </>
  );
}
