"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { AllSourcesModal } from "@/components/dashboard/AllSourcesModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export interface SourceData {
  name: string;
  value: number;
}

interface SourcesBarListProps {
  data: SourceData[];
  allSourcesData: SourceData[];
}

const chartConfig = {
  value: { label: "Artikel", color: "#0f766e" },
} satisfies ChartConfig;

export function SourcesBarList({ data, allSourcesData }: Readonly<SourcesBarListProps>) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const chartData = data.filter((item) => item.name !== "Lainnya").slice(0, 8);
  const othersCount = data.find((item) => item.name === "Lainnya")?.value ?? 0;

  return (
    <>
      <Card className="h-full">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Sumber Teratas</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Media dengan liputan terbanyak</p>
          </div>
          {allSourcesData.length > chartData.length && (
            <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(true)}>
              Lihat semua
            </Button>
          )}
        </div>

        {chartData.length > 0 ? (
          <div>
            <ChartContainer config={chartConfig} className="h-52 w-full aspect-auto">
              <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 12 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={104}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ChartContainer>
            {othersCount > 0 && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="mt-1 text-xs font-medium text-primary hover:underline"
              >
                + {othersCount.toLocaleString("id-ID")} artikel dari sumber lain
              </button>
            )}
          </div>
        ) : (
          <div className="flex h-56 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            Belum ada sumber
          </div>
        )}
      </Card>

      <AllSourcesModal open={isModalOpen} onOpenChange={setIsModalOpen} data={allSourcesData} />
    </>
  );
}
