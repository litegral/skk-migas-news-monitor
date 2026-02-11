"use client";

/**
 * DashboardClient is the client-side component that renders the dashboard UI.
 * It uses SWR for reactive data fetching with auto-revalidation when
 * background analysis completes.
 */

import React from "react";
import { useDashboardData } from "@/lib/hooks/useDashboardData";
import type { DashboardData } from "@/app/api/dashboard/route";

import { KPICards } from "@/components/dashboard/KPICards";
import { SentimentChart } from "@/components/dashboard/SentimentChart";
import { SourcesBarList } from "@/components/dashboard/SourcesBarList";
import { CategoryChart } from "@/components/dashboard/CategoryChart";
import { AnalyzeButton } from "@/components/dashboard/AnalyzeButton";
import { FetchNewsButton } from "@/components/dashboard/FetchNewsButton";
import { AnalysisProgress } from "@/components/dashboard/AnalysisProgress";
import { ArticleFeed } from "@/components/news/ArticleFeed";
import { Card } from "@/components/ui/Card";

interface DashboardClientProps {
  initialData: DashboardData;
}

export function DashboardClient({ initialData }: Readonly<DashboardClientProps>) {
  // Use SWR with server-rendered initial data as fallback
  const { data } = useDashboardData(initialData);
  
  // Track fetch state to disable analyze button during fetch
  const [isFetching, setIsFetching] = React.useState(false);

  // Use SWR data if available, otherwise fall back to initial data
  const dashboardData = data ?? initialData;

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            News monitoring overview for SKK Migas Kalsul.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AnalysisProgress />
          <AnalyzeButton isFetching={isFetching} />
          <FetchNewsButton onFetchingChange={setIsFetching} />
        </div>
      </div>

      {/* KPI cards */}
      <KPICards data={dashboardData.kpiData} />

      {/* Charts row */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SentimentChart data={dashboardData.sentimentData} />
        <SourcesBarList data={dashboardData.sourcesData} />
      </div>

      {/* Category chart */}
      <div className="mt-6">
        <CategoryChart data={dashboardData.categoryData} />
      </div>

      {/* Article feed */}
      <div className="mt-6">
        <Card>
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Recent Articles
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Latest news from all sources
          </p>
          <div className="mt-4">
            <ArticleFeed
              articles={dashboardData.articles}
              availableTopics={dashboardData.availableTopics}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
