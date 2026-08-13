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
  RiLoader4Line,
  RiAddLine,
} from "@remixicon/react";

import type { TopicRow } from "@/lib/types/database";
import type { Article } from "@/lib/types/news";
import type { DashboardPeriod } from "@/lib/types/dashboard";
import { PERIOD_OPTIONS } from "@/lib/types/dashboard";
import type { DashboardLayout } from "@/lib/types/dashboard-layout";
import { setDashboardPeriod } from "@/lib/actions/dashboard-period";
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
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cx } from "@/lib/utils";

// Dashboard components
import { WidgetGrid } from "@/components/dashboard/WidgetGrid";
import { PendingAnalysisNotice } from "@/components/dashboard/PendingAnalysisNotice";
import { SyncStatusIndicator } from "@/components/dashboard/SyncStatusIndicator";
import { FailedArticlesReviewModal } from "@/components/dashboard/FailedArticlesReviewModal";
import { AddArticleModal } from "@/components/news/AddArticleModal";
import { ArticleFeed } from "@/components/news/ArticleFeed";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SidebarTrigger } from "@/components/dashboard/Sidebar";

interface DashboardClientProps {
  widgets: Record<string, React.ReactNode>;
  period: DashboardPeriod;
  topicMap: Record<string, string>;
  availableTopics: string[];
  topics: TopicRow[];
  failedCount: number;
  pendingCount: number;
  decodePendingCount: number;
  initialArticles: Article[];
  totalArticles: number;
  initialCategories: string[];
  initialSources: string[];
}

export function DashboardClient({
  widgets,
  period,
  topicMap,
  availableTopics,
  topics,
  failedCount,
  pendingCount,
  decodePendingCount,
  initialArticles,
  totalArticles,
  initialCategories,
  initialSources,
}: Readonly<DashboardClientProps>) {
  const router = useRouter();
  const [addArticleOpen, setAddArticleOpen] = React.useState(false);
  const [failedReviewOpen, setFailedReviewOpen] = React.useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Dashboard layout state (loaded from localStorage)
  const [layout, setLayout] = React.useState<DashboardLayout>(() =>
    loadDashboardLayout()
  );

  // Edit mode state (default: off, resets on page refresh)
  const [isEditMode, setIsEditMode] = React.useState(false);

  // Handle period change via Next.js router + persist cookie
  const handlePeriodChange = (newPeriod: DashboardPeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", newPeriod);

    startTransition(() => {
      void setDashboardPeriod(newPeriod);
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
        "categories": "categories",
        "topic-watch": "topicWatch"
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
      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION: Ringkasan (Period-dependent data)
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className={cx("transition-opacity duration-300", isPending && "opacity-60")}>
        {/* Section header with settings and period selector */}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <div>
              <h2 className="text-base font-semibold tracking-tight text-slate-950 dark:text-white">
                Ringkasan Kinerja
              </h2>
            </div>
            {isPending && <RiLoader4Line className="size-4 animate-spin text-blue-500" />}
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
                    Selesai Mengatur
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setIsEditMode(true)}>
                    <RiEditLine className="mr-2 size-4" />
                    Atur Tata Letak
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleResetLayout}>
                  <RiRefreshLine className="mr-2 size-4" />
                  Reset Tata Letak
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {failedCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setFailedReviewOpen(true)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20"
                  >
                    Tertunda
                    <Badge variant="warning" className="tabular-nums">
                      {failedCount}
                    </Badge>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  Analisis gagal — klik untuk meninjau dan mengatur sentimen manual
                </TooltipContent>
              </Tooltip>
            )}
            <SyncStatusIndicator
              failedCount={failedCount}
              pendingCount={pendingCount}
              decodePendingCount={decodePendingCount}
              totalArticles={totalArticles}
            />
            <span className="sr-only">Periode ringkasan</span>
            <Select value={period} onValueChange={(v) => handlePeriodChange(v as DashboardPeriod)} disabled={isPending}>
              <SelectTrigger className="w-28 shrink-0">
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
      <section className="mt-6 border-t border-slate-200/80 pt-5 dark:border-slate-800">
        {/* Section header */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
              Liputan Terkini
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Telusuri, filter, dan tinjau artikel dari seluruh sumber aktif.
            </p>
            <PendingAnalysisNotice
              pendingCount={pendingCount}
              decodePendingCount={decodePendingCount}
            />
          </div>
          <Button
            type="button"
            className="shrink-0 self-start gap-2"
            onClick={() => setAddArticleOpen(true)}
          >
            <RiAddLine className="size-4" aria-hidden="true" />
            Tambah artikel secara manual
          </Button>
        </div>

        <AddArticleModal
          topics={topics}
          open={addArticleOpen}
          onOpenChange={setAddArticleOpen}
        />

        <FailedArticlesReviewModal
          open={failedReviewOpen}
          onOpenChange={setFailedReviewOpen}
        />

        {/* Article Feed with its own filters */}
        <Card className="p-4 sm:p-5">
          <ArticleFeed
            key={searchParams.toString()}
            initialArticles={initialArticles}
            totalArticles={totalArticles}
            topicMap={topicMap}
            availableTopics={availableTopics}
            initialCategories={initialCategories}
            initialSources={initialSources}
          />
        </Card>
      </section>
    </>
  );
}
