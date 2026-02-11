import type { Metadata } from "next";
import {
  RiArticleLine,
  RiBarChartBoxLine,
  RiEmotionLine,
  RiTimeLine,
} from "@remixicon/react";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Dashboard - SKK Migas News Monitor",
};

const placeholderKPIs = [
  {
    name: "Total Articles",
    value: "--",
    icon: RiArticleLine,
    description: "Articles collected",
  },
  {
    name: "Positive Sentiment",
    value: "--%",
    icon: RiEmotionLine,
    description: "Of analysed articles",
  },
  {
    name: "Sources Active",
    value: "--",
    icon: RiBarChartBoxLine,
    description: "RSS + API sources",
  },
  {
    name: "Last Updated",
    value: "--",
    icon: RiTimeLine,
    description: "Most recent fetch",
  },
];

export default function DashboardPage() {
  return (
    <>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          News monitoring overview for SKK Migas Kalsul.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {placeholderKPIs.map((kpi) => (
          <Card key={kpi.name}>
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <kpi.icon className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {kpi.name}
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
                  {kpi.value}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
              {kpi.description}
            </p>
          </Card>
        ))}
      </div>

      {/* Charts placeholder */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Sentiment Over Time
          </h2>
          <div className="mt-4 flex h-64 items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Chart will appear here
            </p>
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Sources Breakdown
          </h2>
          <div className="mt-4 flex h-64 items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Chart will appear here
            </p>
          </div>
        </Card>
      </div>

      {/* Article feed placeholder */}
      <div className="mt-6">
        <Card>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Recent Articles
          </h2>
          <div className="mt-4 flex h-48 items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Article feed will appear here
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
