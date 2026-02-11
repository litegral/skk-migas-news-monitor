"use client";

/**
 * AnalyzeButton triggers AI analysis of pending articles.
 *
 * Features:
 * - Shows analysis progress: "Analyze (75/100)"
 * - Shows failed count with retry option: "10 failed - Click to retry"
 * - Resets failed articles before re-analyzing
 * - Disabled during fetch operations
 */

import React from "react";
import { RiSparklingLine, RiLoader4Line } from "@remixicon/react";
import { useSWRConfig } from "swr";

import { Button } from "@/components/ui/Button";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { DASHBOARD_API_KEY, useDashboardData } from "@/lib/hooks/useDashboardData";

interface AnalyzeButtonProps {
  /** Whether the fetch button is currently fetching (disables this button) */
  isFetching?: boolean;
}

export function AnalyzeButton({ isFetching = false }: Readonly<AnalyzeButtonProps>) {
  const { mutate } = useSWRConfig();
  const { data } = useDashboardData();
  const { 
    startAnalysis, 
    isAnalyzing, 
    analyzedCount: sessionAnalyzed, 
    totalPending: sessionTotal, 
    failedCount: sessionFailed 
  } = useAnalysis();
  const [isResetting, setIsResetting] = React.useState(false);

  const kpiData = data?.kpiData;
  const analyzedCount = kpiData?.analyzedCount ?? 0;
  const failedCount = kpiData?.failedCount ?? 0;
  const pendingCount = kpiData?.pendingCount ?? 0;
  const totalArticles = kpiData?.totalArticles ?? 0;

  // Total that should be analyzed = analyzed + pending (excluding current failures)
  const targetCount = analyzedCount + pendingCount + failedCount;

  const isDisabled = isFetching || isResetting || totalArticles === 0;
  const hasFailures = failedCount > 0;
  const hasPending = pendingCount > 0;
  const canAnalyze = hasFailures || hasPending;

  async function handleAnalyze() {
    if (isAnalyzing) return;

    try {
      // If there are failed articles, reset them first
      if (hasFailures) {
        setIsResetting(true);
        const res = await fetch("/api/news/retry", { method: "POST" });
        
        if (!res.ok) {
          const data = await res.json();
          console.error("Failed to reset articles:", data.error);
        }
        
        setIsResetting(false);
        
        // Refresh dashboard data to get updated counts
        await mutate(DASHBOARD_API_KEY);
      }

      // Get the latest pending count after reset
      const refreshedData = await mutate(DASHBOARD_API_KEY);
      const newPendingCount = refreshedData?.kpiData?.pendingCount ?? 0;

      // Start analysis if there are pending articles
      if (newPendingCount > 0) {
        startAnalysis(newPendingCount);
      }
    } catch (err) {
      console.error("Analyze error:", err);
      setIsResetting(false);
    }
  }

  /**
   * Get button text based on current state
   */
  function getButtonText(): string {
    if (isResetting) {
      return "Resetting...";
    }
    if (isAnalyzing) {
      return `Analyzing... ${sessionAnalyzed}/${sessionTotal}`;
    }
    return `Analyze (${analyzedCount}/${targetCount})`;
  }

  /**
   * Get subtext based on current state
   */
  function getSubtext(): { text: string; type: "info" | "warning" | "success" } | null {
    if (isResetting) {
      return { text: "Resetting failed articles...", type: "info" };
    }
    if (isAnalyzing) {
      if (sessionFailed > 0) {
        return { text: `${sessionFailed} failed so far`, type: "warning" };
      }
      return { text: "Processing articles...", type: "info" };
    }
    if (hasFailures) {
      return { text: `${failedCount} failed - Click to retry`, type: "warning" };
    }
    if (hasPending) {
      return { text: `${pendingCount} pending`, type: "info" };
    }
    if (totalArticles === 0) {
      return { text: "No articles", type: "info" };
    }
    return { text: "All articles analyzed", type: "success" };
  }

  const subtext = getSubtext();

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="secondary"
        onClick={handleAnalyze}
        disabled={isDisabled || isAnalyzing || !canAnalyze}
        className="gap-2"
      >
        {isAnalyzing || isResetting ? (
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
