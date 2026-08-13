"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export interface CategoryData {
  category: string;
  count: number;
}

interface CategoryChartProps {
  data: CategoryData[];
}

const chartConfig = {
  count: { label: "Artikel", color: "#2563eb" },
} satisfies ChartConfig;

export function CategoryChart({ data }: Readonly<CategoryChartProps>) {
  const chartData = data.slice(0, 8);

  return (
    <Card className="h-full">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Kategori Dominan</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Topik yang paling sering muncul</p>
      </div>

      {chartData.length > 0 ? (
        <ChartContainer config={chartConfig} className="h-56 w-full aspect-auto">
          <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 12 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
            <YAxis
              dataKey="category"
              type="category"
              tickLine={false}
              axisLine={false}
              width={104}
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[0, 5, 5, 0]} />
          </BarChart>
        </ChartContainer>
      ) : (
        <div className="flex h-56 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Belum ada kategori
        </div>
      )}
    </Card>
  );
}
