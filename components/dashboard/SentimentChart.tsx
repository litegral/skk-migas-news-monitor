"use client";

import { Card } from "@/components/ui/Card";
import { AreaChart } from "@/components/ui/AreaChart";
import type { DashboardPeriod } from "@/lib/types/dashboard";
import { getPeriodLabel } from "@/lib/types/dashboard";

export interface SentimentDataPoint {
  date: string;
  Positif: number;
  Netral: number;
  Negatif: number;
}

interface SentimentChartProps {
  data: SentimentDataPoint[];
  period: DashboardPeriod;
}

export function SentimentChart({ data, period }: Readonly<SentimentChartProps>) {
  const hasData = data.length > 0;
  const periodLabel = getPeriodLabel(period);

  return (
    <Card>
      <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
        Sentimen dari Waktu ke Waktu
      </h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Distribusi sentimen artikel harian ({periodLabel})
      </p>

      {hasData ? (
        <div className="mt-4">
          <AreaChart
            data={data}
            index="date"
            categories={["Positif", "Netral", "Negatif"]}
            colors={["emerald", "gray", "pink"]}
            valueFormatter={(value) => value.toString()}
            showLegend={true}
            showGridLines={true}
            className="h-64"
          />
        </div>
      ) : (
        <div className="mt-4 flex h-64 items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Belum ada data untuk periode {periodLabel.toLowerCase()}
          </p>
        </div>
      )}
    </Card>
  );
}
