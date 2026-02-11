"use client";

import React from "react";
import {
  RiArticleLine,
  RiEmotionHappyLine,
  RiEmotionUnhappyLine,
  RiEmotionNormalLine,
} from "@remixicon/react";

import { Card } from "@/components/ui/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { cx } from "@/lib/utils";
import type { Article } from "@/lib/types/news";

/** Time period in months for filtering */
type TimePeriod = "1" | "3" | "6";

interface KPICardsProps {
  articles: Article[];
  totalArticles: number;
}

export function KPICards({ articles, totalArticles }: Readonly<KPICardsProps>) {
  const [period, setPeriod] = React.useState<TimePeriod>("3");

  // Filter articles by time period
  const filteredArticles = React.useMemo(() => {
    const months = parseInt(period, 10);
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);

    return articles.filter((article) => {
      if (!article.publishedAt) return false;
      const publishedDate = new Date(article.publishedAt);
      return publishedDate >= cutoffDate;
    });
  }, [articles, period]);

  // Count sentiments from filtered articles (only analyzed ones)
  const sentimentCounts = React.useMemo(() => {
    const analyzed = filteredArticles.filter(
      (a) => a.aiProcessed && a.sentiment != null
    );
    return {
      positive: analyzed.filter((a) => a.sentiment === "positive").length,
      negative: analyzed.filter((a) => a.sentiment === "negative").length,
      neutral: analyzed.filter((a) => a.sentiment === "neutral").length,
    };
  }, [filteredArticles]);

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
      value: sentimentCounts.positive.toLocaleString("id-ID"),
      icon: RiEmotionHappyLine,
      description: `Dalam ${period} bulan terakhir`,
      color: "emerald" as const,
    },
    {
      name: "Berita Negatif",
      value: sentimentCounts.negative.toLocaleString("id-ID"),
      icon: RiEmotionUnhappyLine,
      description: `Dalam ${period} bulan terakhir`,
      color: "rose" as const,
    },
    {
      name: "Berita Netral",
      value: sentimentCounts.neutral.toLocaleString("id-ID"),
      icon: RiEmotionNormalLine,
      description: `Dalam ${period} bulan terakhir`,
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
    <div>
      {/* Header with time filter */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Ringkasan
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Periode:
          </span>
          <Select value={period} onValueChange={(v: TimePeriod) => setPeriod(v)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Bulan</SelectItem>
              <SelectItem value="3">3 Bulan</SelectItem>
              <SelectItem value="6">6 Bulan</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI cards grid */}
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
    </div>
  );
}
