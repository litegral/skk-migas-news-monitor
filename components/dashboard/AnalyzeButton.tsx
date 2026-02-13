"use client";

/**
 * AnalyzeButton triggers AI analysis of pending articles.
 *
 * Features:
 * - Automatically decodes URLs first if there are decode-pending articles
 * - Shows decode progress: "Memproses URL 5/18"
 * - Shows analysis progress: "Menganalisis 75/100"
 * - Shows failed count with retry option: "10 failed - Click to retry"
 * - Resets failed articles before re-analyzing
 * - Disabled during fetch operations
 */

import React from "react";
import { RiSparklingLine, RiLoader4Line } from "@remixicon/react";
import { useSWRConfig } from "swr";

import { Button } from "@/components/ui/Button";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { DASHBOARD_API_BASE, useDashboardData } from "@/lib/hooks/useDashboardData";
import type { DashboardPeriod } from "@/lib/types/dashboard";

interface AnalyzeButtonProps {
  /** Whether the fetch button is currently fetching (disables this button) */
  isFetching?: boolean;
  /** Current period for dashboard filtering */
  period: DashboardPeriod;
}

export function AnalyzeButton({ isFetching = false, period }: Readonly<AnalyzeButtonProps>) {
  const { mutate } = useSWRConfig();
  const { data } = useDashboardData({ period });
  const { 
    startProcess,
    isProcessing,
    isDecoding,
    isAnalyzing, 
    decodeProgress,
    analyzedCount: sessionAnalyzed, 
    totalPending: sessionTotal, 
    failedCount: sessionFailed 
  } = useAnalysis();
  const [isResetting, setIsResetting] = React.useState(false);

  const kpiData = data?.kpiData;
  const analyzedCount = kpiData?.analyzedCount ?? 0;
  const failedCount = kpiData?.failedCount ?? 0;
  const pendingCount = kpiData?.pendingCount ?? 0;
  const decodePendingCount = kpiData?.decodePendingCount ?? 0;
  const totalArticles = kpiData?.totalArticles ?? 0;

  // Total that should be analyzed = analyzed + pending + decode-pending (excluding current failures)
  const targetCount = analyzedCount + pendingCount + decodePendingCount + failedCount;

  const isDisabled = isFetching || isResetting || totalArticles === 0;
  const hasFailures = failedCount > 0;
  const hasPending = pendingCount > 0;
  const hasDecodePending = decodePendingCount > 0;
  // Can process if there are failures, pending analysis, or pending decode
  const canProcess = hasFailures || hasPending || hasDecodePending;

  async function handleProcess() {
    if (isProcessing) return;

    try {
      // If there are failed articles, reset them first
      if (hasFailures) {
        setIsResetting(true);
        const res = await fetch("/api/news/retry", { method: "POST" });
        
        if (!res.ok) {
          const responseData = await res.json();
          console.error("Failed to reset articles:", responseData.error);
        }
        
        setIsResetting(false);
        
        // Refresh dashboard data to get updated counts
        await mutate(
          (key: string) => typeof key === "string" && key.startsWith(DASHBOARD_API_BASE),
          undefined,
          { revalidate: true }
        );
      }

      // Get fresh dashboard data to check pending counts
      const freshRes = await fetch(`${DASHBOARD_API_BASE}?period=${period}`);
      const freshJson = await freshRes.json();
      const freshDecodePendingCount = freshJson.data?.kpiData?.decodePendingCount ?? 0;
      const freshPendingCount = freshJson.data?.kpiData?.pendingCount ?? 0;

      // Start the full process (decode if needed, then analyze)
      if (freshDecodePendingCount > 0 || freshPendingCount > 0) {
        startProcess(freshDecodePendingCount, freshPendingCount);
      }
    } catch (err) {
      console.error("Process error:", err);
      setIsResetting(false);
    }
  }

  /**
   * Get button text based on current state
   */
  function getButtonText(): string {
    if (isResetting) {
      return "Mereset...";
    }
    if (isDecoding && decodeProgress) {
      const current = decodeProgress.decoded + decodeProgress.failed;
      return `Proses URL ${current}/${decodeProgress.total}`;
    }
    if (isAnalyzing) {
      return `Analisis ${sessionAnalyzed}/${sessionTotal}`;
    }
    return `Analisis (${analyzedCount}/${targetCount})`;
  }

  /**
   * Get subtext based on current state
   */
  function getSubtext(): { text: string; type: "info" | "warning" | "success" } | null {
    if (isResetting) {
      return { text: "Mereset artikel yang gagal...", type: "info" };
    }
    if (isDecoding) {
      return { text: "Memproses URL Google News...", type: "info" };
    }
    if (isAnalyzing) {
      if (sessionFailed > 0) {
        return { text: `${sessionFailed} gagal sejauh ini`, type: "warning" };
      }
      return { text: "Menganalisis artikel...", type: "info" };
    }
    if (hasFailures) {
      return { text: `${failedCount} gagal - Klik untuk coba lagi`, type: "warning" };
    }
    if (hasDecodePending && hasPending) {
      return { text: `${decodePendingCount} proses URL, ${pendingCount} siap analisis`, type: "info" };
    }
    if (hasDecodePending) {
      return { text: `${decodePendingCount} perlu proses URL dulu`, type: "info" };
    }
    if (hasPending) {
      return { text: `${pendingCount} siap dianalisis`, type: "info" };
    }
    if (totalArticles === 0) {
      return { text: "Tidak ada artikel", type: "info" };
    }
    return { text: "Semua artikel teranalisis", type: "success" };
  }

  const subtext = getSubtext();

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="secondary"
        onClick={handleProcess}
        disabled={isDisabled || isProcessing || !canProcess}
        className="gap-2"
      >
        {isProcessing || isResetting ? (
          <RiLoader4Line className="size-4 animate-spin" />
        ) : (
          <RiSparklingLine className="size-4" />
        )}
        {getButtonText()}
      </Button>
      {subtext && (
        <p
          className={`text-xs ${
            subtext.type === "warning"
              ? "text-amber-600 dark:text-amber-400"
              : subtext.type === "success"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {subtext.text}
        </p>
      )}
    </div>
  );
}
