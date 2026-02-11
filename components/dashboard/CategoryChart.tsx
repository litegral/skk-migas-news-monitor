"use client";

import { Card } from "@/components/ui/Card";
import { BarChart } from "@/components/ui/BarChart";

export interface CategoryData {
  category: string;
  count: number;
}

interface CategoryChartProps {
  data: CategoryData[];
}

export function CategoryChart({ data }: Readonly<CategoryChartProps>) {
  const hasData = data.length > 0;

  // Transform for BarChart: needs { index, category1, category2, ... }
  // For a single-category bar chart, we use the category as index and count as the value
  const chartData = data.map((item) => ({
    category: item.category,
    Artikel: item.count,
  }));

  return (
    <Card>
      <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
        Distribusi Kategori
      </h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Artikel berdasarkan kategori topik
      </p>

      {hasData ? (
        <div className="mt-4">
          <BarChart
            data={chartData}
            index="category"
            categories={["Artikel"]}
            colors={["blue"]}
            valueFormatter={(value) => value.toString()}
            showLegend={false}
            showGridLines={true}
            className="h-64"
            layout="vertical"
            yAxisWidth={120}
          />
        </div>
      ) : (
        <div className="mt-4 flex h-64 items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Belum ada kategori
          </p>
        </div>
      )}
    </Card>
  );
}
