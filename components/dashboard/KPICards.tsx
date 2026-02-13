"use client";

import {
  RiArticleLine,
  RiEmotionHappyLine,
  RiEmotionUnhappyLine,
  RiEmotionNormalLine,
} from "@remixicon/react";

import { Card } from "@/components/ui/Card";
import { cx } from "@/lib/utils";
import type { DashboardPeriod } from "@/lib/types/dashboard";
import { getPeriodLabel } from "@/lib/types/dashboard";

interface KPICardsProps {
  totalArticles: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  period: DashboardPeriod;
}

export function KPICards({
  totalArticles,
  positiveCount,
  negativeCount,
  neutralCount,
  period,
}: Readonly<KPICardsProps>) {
  const periodLabel = getPeriodLabel(period);

  const kpis = [
    {
      name: "Total Artikel",
      value: totalArticles.toLocaleString("id-ID"),
      icon: RiArticleLine,
      description: "Semua artikel yang dikumpulkan",
      color: "blue" as const,
    },
    {
      name: "Berita Positif",
      value: positiveCount.toLocaleString("id-ID"),
      icon: RiEmotionHappyLine,
      description: `Dalam ${periodLabel.toLowerCase()}`,
      color: "emerald" as const,
    },
    {
      name: "Berita Negatif",
      value: negativeCount.toLocaleString("id-ID"),
      icon: RiEmotionUnhappyLine,
      description: `Dalam ${periodLabel.toLowerCase()}`,
      color: "rose" as const,
    },
    {
      name: "Berita Netral",
      value: neutralCount.toLocaleString("id-ID"),
      icon: RiEmotionNormalLine,
      description: `Dalam ${periodLabel.toLowerCase()}`,
      color: "gray" as const,
    },
  ];

  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    emerald:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
    gray: "bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400",
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.name}>
          <div className="flex items-center gap-3">
            <div
              className={cx(
                "flex size-10 shrink-0 items-center justify-center rounded-lg",
                colorClasses[kpi.color],
              )}
            >
              <kpi.icon className="size-5" aria-hidden="true" />
            </div>
            <div className="flex-1">
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
  );
}
