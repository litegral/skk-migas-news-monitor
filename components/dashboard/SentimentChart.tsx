"use client";

import { Card } from "@/components/ui/Card";
import { AreaChart } from "@/components/ui/AreaChart";

export interface SentimentDataPoint {
  date: string;
  Positive: number;
  Neutral: number;
  Negative: number;
}

interface SentimentChartProps {
  data: SentimentDataPoint[];
}

export function SentimentChart({ data }: Readonly<SentimentChartProps>) {
  const hasData = data.length > 0;

  return (
    <Card>
      <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
        Sentiment Over Time
      </h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Daily article sentiment distribution
      </p>

      {hasData ? (
        <div className="mt-4">
          <AreaChart
            data={data}
            index="date"
            categories={["Positive", "Neutral", "Negative"]}
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
            No data available yet
          </p>
        </div>
      )}
    </Card>
  );
}
