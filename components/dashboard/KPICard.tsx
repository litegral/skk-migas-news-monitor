"use client";

/**
 * KPICard - Individual KPI card component for the dashboard.
 * Used within the draggable widget grid.
 */

import {
  RiArrowDownLine,
  RiArrowRightLine,
  RiArrowUpLine,
  RiArticleLine,
  RiEmotionHappyLine,
  RiEmotionUnhappyLine,
  RiEmotionNormalLine,
  RiFilterLine,
} from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cx } from "@/lib/utils";
import type { DashboardPeriod } from "@/lib/types/dashboard";
import { getPeriodLabel, PERIOD_OPTIONS } from "@/lib/types/dashboard";

/** KPI card types */
export type KPIType = "total" | "positive" | "negative" | "neutral";

interface KPICardProps {
  type: KPIType;
  value: number;
  changePercent: number | null;
  hasPreviousPeriod: boolean;
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
    getDescription: (periodLabel) => `Dalam ${periodLabel.toLowerCase()}`,
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

export function KPICard({
  type,
  value,
  changePercent,
  hasPreviousPeriod,
  period,
}: Readonly<KPICardProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const config = KPI_CONFIG[type];
  const periodLabel = getPeriodLabel(period);
  const Icon = config.icon;

  function showFilteredArticles() {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["feedSentiment", "feedFrom", "feedTo"]) params.delete(key);

    if (type !== "total") params.set("feedSentiment", type);
    const days = PERIOD_OPTIONS.find((option) => option.value === period)?.days ?? null;
    if (days !== null) {
      const from = new Date();
      from.setDate(from.getDate() - days);
      params.set("feedFrom", from.toISOString());
      params.set("feedTo", new Date().toISOString());
    }

    router.replace(`${pathname}?${params.toString()}#articles`, { scroll: false });
    window.setTimeout(() => {
      document.getElementById("articles")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

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
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
              {config.name}
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={showFilteredArticles}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Filter artikel berdasarkan ${config.name.toLowerCase()}`}
                >
                  <RiFilterLine className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Tampilkan {config.name.toLowerCase()} untuk periode {periodLabel.toLowerCase()}.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950 tabular-nums dark:text-white">
            {value.toLocaleString("id-ID")}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <p className="min-w-0 truncate text-[11px] text-slate-400 dark:text-slate-500">
          {config.getDescription(periodLabel)}
        </p>
        {hasPreviousPeriod && (
          <ComparisonBadge type={type} value={changePercent} />
        )}
      </div>
    </Card>
  );
}

function ComparisonBadge({ type, value }: Readonly<{ type: KPIType; value: number | null }>) {
  if (value === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="shrink-0 cursor-help text-[10px] font-medium text-blue-600 dark:text-blue-400">
            Baru
          </span>
        </TooltipTrigger>
        <TooltipContent>Tidak ada data pada periode pembanding.</TooltipContent>
      </Tooltip>
    );
  }

  const TrendIcon = value > 0 ? RiArrowUpLine : value < 0 ? RiArrowDownLine : RiArrowRightLine;
  const isNegativeTrend = type === "negative" && value > 0;
  const isPositiveTrend =
    ((type === "positive" || type === "total") && value > 0) ||
    (type === "negative" && value < 0);
  const isUnfavorableTrend =
    isNegativeTrend || ((type === "positive" || type === "total") && value < 0);

  const direction = value > 0 ? "naik" : value < 0 ? "turun" : "tidak berubah";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cx(
            "inline-flex shrink-0 cursor-help items-center gap-0.5 text-[10px] font-semibold tabular-nums",
            isNegativeTrend
              ? "text-rose-600 dark:text-rose-400"
              : isPositiveTrend
                ? "text-emerald-600 dark:text-emerald-400"
                : isUnfavorableTrend
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-muted-foreground",
          )}
        >
          <TrendIcon className="size-3" />
          {Math.abs(value).toLocaleString("id-ID")}%
          <span className="font-normal text-muted-foreground">vs lalu</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {type === "neutral" ? "Jumlah berita netral" : "Jumlah artikel"} {direction}{value !== 0 ? ` ${Math.abs(value)}%` : ""} dibandingkan periode sebelumnya.
      </TooltipContent>
    </Tooltip>
  );
}
