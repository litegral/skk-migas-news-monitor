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

import { Card } from "@/components/ui/card";
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
    <Card className="h-full overflow-hidden p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div
          className={cx(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            colorClasses[config.color],
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
            {config.name}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950 tabular-nums dark:text-white">
            {value.toLocaleString("id-ID")}
          </p>
        </div>
      </div>
      <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
        {config.getDescription(periodLabel)}
      </p>
    </Card>
  );
}
