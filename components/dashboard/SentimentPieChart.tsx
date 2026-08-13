"use client";

import { Label, Pie, PieChart } from "recharts";

import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { DashboardPeriod, SentimentPieData } from "@/lib/types/dashboard";
import { getPeriodLabel } from "@/lib/types/dashboard";

interface SentimentPieChartProps {
  data: SentimentPieData;
  period: DashboardPeriod;
}

const chartConfig = {
  positive: { label: "Positif", color: "#059669" },
  neutral: { label: "Netral", color: "#64748b" },
  negative: { label: "Negatif", color: "#e11d48" },
} satisfies ChartConfig;

export function SentimentPieChart({ data, period }: Readonly<SentimentPieChartProps>) {
  const periodLabel = getPeriodLabel(period);
  const chartData = [
    { sentiment: "positive", articles: data.positive, fill: "var(--color-positive)" },
    { sentiment: "neutral", articles: data.neutral, fill: "var(--color-neutral)" },
    { sentiment: "negative", articles: data.negative, fill: "var(--color-negative)" },
  ].filter((item) => item.articles > 0);

  return (
    <Card className="h-full">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Komposisi Sentimen</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Perbandingan sentimen · {periodLabel}
        </p>
      </div>

      {data.total > 0 ? (
        <ChartContainer config={chartConfig} className="mx-auto h-56 w-full max-w-md aspect-auto">
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent nameKey="sentiment" hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="articles"
              nameKey="sentiment"
              innerRadius={56}
              outerRadius={78}
              strokeWidth={4}
            >
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
                  return (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
                        {data.total.toLocaleString("id-ID")}
                      </tspan>
                      <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-[10px]">
                        ARTIKEL
                      </tspan>
                    </text>
                  );
                }}
              />
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="sentiment" />} />
          </PieChart>
        </ChartContainer>
      ) : (
        <div className="flex h-56 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Belum ada data untuk {periodLabel.toLowerCase()}
        </div>
      )}
    </Card>
  );
}
