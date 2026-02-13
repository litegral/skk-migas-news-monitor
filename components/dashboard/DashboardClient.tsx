"use client";

/**
 * DashboardClient is the client-side component that renders the dashboard UI.
 * Uses SWR for reactive data fetching with auto-revalidation when
 * background analysis completes.
 *
 * Visual hierarchy:
 * - Ringkasan section (period-dependent data with period selector)
 *   - Settings icon to toggle edit mode for drag/resize
 * - Artikel Terbaru section (independent, always shows recent articles)
 */

import React from "react";
import {
  RiSettings3Line,
  RiEditLine,
  RiCheckLine,
  RiRefreshLine,
} from "@remixicon/react";
import { useDashboardData } from "@/lib/hooks/useDashboardData";
import type { DashboardData } from "@/app/api/dashboard/route";
import type { DashboardPeriod } from "@/lib/types/dashboard";
import { DEFAULT_PERIOD, PERIOD_OPTIONS } from "@/lib/types/dashboard";
import type { DashboardLayout } from "@/lib/types/dashboard-layout";
import {
  loadDashboardLayout,
  saveDashboardLayout,
  resetDashboardLayout,
} from "@/lib/utils/dashboardLayout";

const PERIOD_STORAGE_KEY = "skkmigas-dashboard-period";

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
import { KPICard } from "@/components/dashboard/KPICard";
import { SentimentChart } from "@/components/dashboard/SentimentChart";
import { SentimentPieChart } from "@/components/dashboard/SentimentPieChart";
import { SourcesBarList } from "@/components/dashboard/SourcesBarList";
import { CategoryChart } from "@/components/dashboard/CategoryChart";
import { AnalyzeButton } from "@/components/dashboard/AnalyzeButton";
import { FetchNewsButton } from "@/components/dashboard/FetchNewsButton";
import { AnalysisProgress } from "@/components/dashboard/AnalysisProgress";
import { AutoFetchIndicator } from "@/components/dashboard/AutoFetchIndicator";
import { ArticleFeed } from "@/components/news/ArticleFeed";

interface DashboardClientProps {
  initialData: DashboardData;
}

export function DashboardClient({ initialData }: Readonly<DashboardClientProps>) {
  // Period state for filtering dashboard data (persisted to localStorage)
  const [period, setPeriod] = React.useState<DashboardPeriod>(() => {
    if (typeof window === "undefined") return initialData.period ?? DEFAULT_PERIOD;
    try {
      const saved = localStorage.getItem(PERIOD_STORAGE_KEY);
      if (saved && PERIOD_OPTIONS.some((o) => o.value === saved)) {
        return saved as DashboardPeriod;
      }
    } catch {
      // Ignore localStorage errors
    }
    return initialData.period ?? DEFAULT_PERIOD;
  });

  // Persist period to localStorage on change
  React.useEffect(() => {
    try {
      localStorage.setItem(PERIOD_STORAGE_KEY, period);
    } catch {
      // Ignore localStorage errors
    }
  }, [period]);

  // Track fetch state to disable analyze button during fetch
  const [isFetching, setIsFetching] = React.useState(false);

  // Dashboard layout state (loaded from localStorage)
  const [layout, setLayout] = React.useState<DashboardLayout>(() =>
    loadDashboardLayout()
  );

  // Edit mode state (default: off, resets on page refresh)
  const [isEditMode, setIsEditMode] = React.useState(false);

  // Use SWR with period parameter
  const { data } = useDashboardData({ period, fallbackData: initialData });

  // Use SWR data if available, otherwise fall back to initial data
  const dashboardData = data ?? initialData;

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

  // Render widget by ID
  const renderWidget = React.useCallback(
    (id: string) => {
      switch (id) {
        case "kpi-total":
          return (
            <KPICard
              type="total"
              value={dashboardData.totalArticles}
              period={period}
            />
          );
        case "kpi-positive":
          return (
            <KPICard
              type="positive"
              value={dashboardData.sentimentPieData.positive}
              period={period}
            />
          );
        case "kpi-negative":
          return (
            <KPICard
              type="negative"
              value={dashboardData.sentimentPieData.negative}
              period={period}
            />
          );
        case "kpi-neutral":
          return (
            <KPICard
              type="neutral"
              value={dashboardData.sentimentPieData.neutral}
              period={period}
            />
          );
        case "sentiment-timeline":
          return (
            <SentimentChart data={dashboardData.sentimentData} period={period} />
          );
        case "sentiment-pie":
          return (
            <SentimentPieChart
              data={dashboardData.sentimentPieData}
              period={period}
            />
          );
        case "sources":
          return (
            <SourcesBarList
              data={dashboardData.sourcesData}
              allSourcesData={dashboardData.allSourcesData}
            />
          );
        case "categories":
          return <CategoryChart data={dashboardData.categoryData} />;
        default:
          return null;
      }
    },
    [dashboardData, period],
  );

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Pemantauan berita untuk SKK Migas Kalsul.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <AnalysisProgress />
          <AnalyzeButton isFetching={isFetching} period={period} />
          <FetchNewsButton onFetchingChange={setIsFetching} />
          <AutoFetchIndicator />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION: Ringkasan (Period-dependent data)
          ═══════════════════════════════════════════════════════════════════════ */}
      <section>
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
            <Select value={period} onValueChange={(v) => setPeriod(v as DashboardPeriod)}>
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
            articles={dashboardData.articles}
            availableTopics={dashboardData.availableTopics}
          />
        </Card>
      </section>
    </>
  );
}
