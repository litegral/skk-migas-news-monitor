"use client";

import {
  RiArrowRightLine,
  RiArrowUpLine,
  RiShieldCheckLine,
} from "@remixicon/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PERIOD_OPTIONS,
  type DashboardPeriod,
  type TopicWatchInsight,
  type TopicWatchStatus,
} from "@/lib/types/dashboard";
import { cx } from "@/lib/utils";

interface TopicWatchPanelProps {
  data: TopicWatchInsight[];
  period: DashboardPeriod;
}

const statusConfig: Record<TopicWatchStatus, {
  label: string;
  variant: "error" | "warning" | "neutral";
  bar: string;
  tooltip: string;
}> = {
  priority: {
    label: "Negatif tinggi",
    variant: "error",
    bar: "bg-rose-500",
    tooltip: "Porsi negatif sedikitnya 40% dengan minimal dua artikel.",
  },
  rising: {
    label: "Liputan naik",
    variant: "warning",
    bar: "bg-amber-500",
    tooltip: "Volume naik sedikitnya 50% atau baru muncul pada periode ini.",
  },
  stable: {
    label: "Stabil",
    variant: "neutral",
    bar: "bg-slate-400",
    tooltip: "Belum melewati ambang prioritas atau peningkatan volume.",
  },
};

export function TopicWatchPanel({ data, period }: Readonly<TopicWatchPanelProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function openTopic(topicName: string) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["feedSentiment", "feedTopic", "feedFrom", "feedTo"]) {
      params.delete(key);
    }
    params.set("feedTopic", topicName);

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
    <Card className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Topik Perlu Dipantau</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Diurutkan berdasarkan porsi negatif dan kenaikan jumlah liputan
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Top 5
        </span>
      </div>

      {data.length > 0 ? (
        <ol className="grid h-56 grid-rows-5 gap-1">
          {data.map((topic, index) => {
            const status = statusConfig[topic.status];
            return (
              <li key={topic.id} className="min-h-0 rounded-lg bg-muted/35 transition-colors hover:bg-muted/60">
                <button
                  type="button"
                  onClick={() => openTopic(topic.name)}
                  className="group flex h-full w-full items-center gap-2 px-2 py-1 text-left"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-background text-[10px] font-semibold tabular-nums text-muted-foreground ring-1 ring-border/70">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {topic.name}
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span onClick={(event) => event.stopPropagation()}>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{status.tooltip}</TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="h-1 min-w-12 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cx("h-full rounded-full", status.bar)}
                          style={{ width: `${topic.negativeShare}%` }}
                        />
                      </div>
                      <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                        {topic.negativeShare}% negatif
                      </span>
                    </div>
                  </div>
                  <div className="w-24 shrink-0 text-right leading-tight">
                    <p className="text-[11px] font-semibold tabular-nums text-foreground">
                      {topic.articles} liputan
                    </p>
                    {period !== "all" && (
                      <p className={cx(
                        "mt-0.5 inline-flex items-center justify-end gap-0.5 text-[9px] tabular-nums",
                        topic.changePercent !== null && topic.changePercent > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground",
                      )}>
                        {topic.changePercent === null ? (
                          "Baru periode ini"
                        ) : (
                          <>
                            {topic.changePercent > 0 && <RiArrowUpLine className="size-3" />}
                            {topic.changePercent > 0 ? "+" : ""}{topic.changePercent}% vs lalu
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  <RiArrowRightLine className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed px-5 text-center">
          <RiShieldCheckLine className="size-6 text-emerald-500" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-foreground">Belum ada topik pada periode ini</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Panel akan terisi setelah artikel cocok dengan topik aktif.
          </p>
        </div>
      )}
    </Card>
  );
}
