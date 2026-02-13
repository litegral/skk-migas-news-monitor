"use client";

/**
 * KPICard - Individual KPI card component for the dashboard.
 * Used within the draggable widget grid.
 */

import {
  RiArticleLine,
  RiEmotionHappyLine,
  RiEmotionUnhappyLine,
  RiEmotionNormalLine,
} from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";

import { Card } from "@/components/ui/Card";
import { cx } from "@/lib/utils";
import type { DashboardPeriod } from "@/lib/types/dashboard";
import { getPeriodLabel } from "@/lib/types/dashboard";

/** KPI card types */
export type KPIType = "total" | "positive" | "negative" | "neutral";

interface KPICardProps {
  type: KPIType;
  value: number;
  period: DashboardPeriod;
}

/** Configuration for each KPI type */
interface KPIConfig {
  name: string;
  icon: RemixiconComponentType;
  color: "blue" | "emerald" | "rose" | "gray";
  getDescription: (periodLabel: string) => string;
}

const KPI_CONFIG: Record<KPIType, KPIConfig> = {
  total: {
    name: "Total Artikel",
    icon: RiArticleLine,
    color: "blue",
    getDescription: () => "Semua artikel yang dikumpulkan",
  },
  positive: {
    name: "Berita Positif",
    icon: RiEmotionHappyLine,
    color: "emerald",
    getDescription: (periodLabel) => `Dalam ${periodLabel.toLowerCase()}`,
  },
  negative: {
    name: "Berita Negatif",
    icon: RiEmotionUnhappyLine,
    color: "rose",
    getDescription: (periodLabel) => `Dalam ${periodLabel.toLowerCase()}`,
  },
  neutral: {
    name: "Berita Netral",
    icon: RiEmotionNormalLine,
    color: "gray",
    getDescription: (periodLabel) => `Dalam ${periodLabel.toLowerCase()}`,
  },
};

const colorClasses = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  gray: "bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400",
};

export function KPICard({ type, value, period }: Readonly<KPICardProps>) {
  const config = KPI_CONFIG[type];
  const periodLabel = getPeriodLabel(period);
  const Icon = config.icon;

  return (
    <Card className="h-full">
      <div className="flex items-center gap-3">
        <div
          className={cx(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            colorClasses[config.color],
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {config.name}
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            {value.toLocaleString("id-ID")}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        {config.getDescription(periodLabel)}
      </p>
    </Card>
  );
}
