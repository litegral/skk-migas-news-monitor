"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
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

const chartConfig = {
  Positif: { label: "Positif", color: "#059669" },
  Netral: { label: "Netral", color: "#64748b" },
  Negatif: { label: "Negatif", color: "#e11d48" },
} satisfies ChartConfig;

export function SentimentChart({ data, period }: Readonly<SentimentChartProps>) {
  const periodLabel = getPeriodLabel(period);

  return (
    <Card className="h-full">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Tren Sentimen</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pergerakan artikel harian · {periodLabel}
        </p>
      </div>

      {data.length > 0 ? (
        <ChartContainer config={chartConfig} className="h-56 w-full aspect-auto">
          <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
            <defs>
              {Object.entries(chartConfig).map(([key, config]) => (
                <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={config.color} stopOpacity={0.24} />
                  <stop offset="95%" stopColor={config.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
            <ChartLegend content={<ChartLegendContent />} />
            {Object.entries(chartConfig).map(([key, config]) => (
              <Area
                key={key}
                dataKey={key}
                type="monotone"
                fill={`url(#fill-${key})`}
                stroke={config.color}
                strokeWidth={2.25}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      ) : (
        <EmptyChart message={`Belum ada data untuk ${periodLabel.toLowerCase()}`} />
      )}
    </Card>
  );
}

function EmptyChart({ message }: Readonly<{ message: string }>) {
  return (
    <div className="flex h-56 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {message}
    </div>
  );
}
