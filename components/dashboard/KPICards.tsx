import {
  RiArticleLine,
  RiBarChartBoxLine,
  RiCheckDoubleLine,
  RiEmotionLine,
  RiTimeLine,
} from "@remixicon/react";
import { formatDistanceToNow } from "date-fns";

import { Card } from "@/components/ui/Card";
import { cx } from "@/lib/utils";

export interface KPIData {
  totalArticles: number;
  analyzedCount: number;  // Successfully analyzed (has summary)
  failedCount: number;    // Failed analysis (has ai_error)
  pendingCount: number;   // Not yet processed
  positivePercent: number;
  activeSources: number;
  lastUpdated: string | null;
}

interface KPICardsProps {
  data: KPIData;
}

export function KPICards({ data }: Readonly<KPICardsProps>) {
  const lastUpdatedText = data.lastUpdated
    ? formatDistanceToNow(new Date(data.lastUpdated), { addSuffix: true })
    : "Never";

  const kpis = [
    {
      name: "Total Articles",
      value: data.totalArticles.toLocaleString(),
      icon: RiArticleLine,
      description: "Articles collected",
      color: "blue",
    },
    {
      name: "Analyzed",
      value: `${data.analyzedCount}/${data.totalArticles}`,
      icon: RiCheckDoubleLine,
      description: "Articles processed by AI",
      color: "cyan",
    },
    {
      name: "Positive Sentiment",
      value: `${data.positivePercent}%`,
      icon: RiEmotionLine,
      description: "Of analyzed articles",
      color: "emerald",
    },
    {
      name: "Sources Active",
      value: data.activeSources.toLocaleString(),
      icon: RiBarChartBoxLine,
      description: "Publishers with matching topics",
      color: "violet",
    },
    {
      name: "Last Updated",
      value: lastUpdatedText,
      icon: RiTimeLine,
      description: "Most recent article",
      color: "amber",
    },
  ] as const;

  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    cyan: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400",
    emerald:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    violet:
      "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  } as const;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
            <div>
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
