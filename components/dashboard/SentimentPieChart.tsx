"use client";

import { Card } from "@/components/ui/Card";
import { DonutChart } from "@/components/ui/DonutChart";
import type { SentimentPieData } from "@/app/api/dashboard/route";
import type { DashboardPeriod } from "@/lib/types/dashboard";
import { getPeriodLabel } from "@/lib/types/dashboard";

interface SentimentPieChartProps {
  data: SentimentPieData;
  period: DashboardPeriod;
}

// Sentiment color mapping (consistent regardless of order)
const SENTIMENT_COLORS: Record<string, "emerald" | "pink" | "gray"> = {
  Positif: "emerald",
  Negatif: "pink",
  Netral: "gray",
};

export function SentimentPieChart({ data, period }: Readonly<SentimentPieChartProps>) {
  const hasData = data.total > 0;
  const periodLabel = getPeriodLabel(period);

  // Create chart data sorted by count (descending)
  const chartData = [
    { name: "Positif", value: data.positive },
    { name: "Negatif", value: data.negative },
    { name: "Netral", value: data.neutral },
  ].sort((a, b) => b.value - a.value);

  // Colors array must match the sorted order
  const colors = chartData.map((item) => SENTIMENT_COLORS[item.name]);

  return (
    <Card>
      <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
        Distribusi Sentimen
      </h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Proporsi sentimen artikel ({periodLabel})
      </p>

      {hasData ? (
        <div className="mt-4">
          <DonutChart
            data={chartData}
            colors={colors}
            valueFormatter={(value) => `${value} artikel`}
            label={`${data.total}`}
            showLegend={true}
            showTooltip={true}
          />
        </div>
      ) : (
        <div className="mt-4 flex h-48 items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Belum ada data untuk periode {periodLabel.toLowerCase()}
          </p>
        </div>
      )}
    </Card>
  );
}
