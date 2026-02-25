"use client";

/**
 * SyncButton — unified button that replaces FetchNewsButton + AnalyzeButton.
 *
 * Smart pipeline logic:
 * - If there are failed articles → reset failed → decode → analyze
 * - If there are pending analysis/decode-pending articles → decode → analyze (skip fetch)
 * - If nothing pending → fetch → decode → analyze (full pipeline)
 *
 * 5-minute cooldown applies only to the fetch phase.
 * Analysis-only runs are always allowed.
 */

import React from "react";
import {
  RiRefreshLine,
  RiSparklingLine,
  RiLoader4Line,
  RiCheckLine,
  RiErrorWarningLine,
} from "@remixicon/react";
import { useSWRConfig } from "swr";

import { Button } from "@/components/ui/Button";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { useAutoFetch } from "@/contexts/AutoFetchContext";
import { DASHBOARD_API_BASE, useDashboardData } from "@/lib/hooks/useDashboardData";
import type { DashboardPeriod } from "@/lib/types/dashboard";

/** Cooldown duration: 5 minutes in milliseconds */
const FETCH_COOLDOWN_MS = 5 * 60 * 1000;

/** localStorage key for manual button cooldown */
const COOLDOWN_KEY = "skkmigas_lastNewsFetchTime";

interface SyncButtonProps {
  /** Current period for dashboard filtering */
  period: DashboardPeriod;
}

/**
 * Format remaining cooldown time as human-readable string.
 */
function formatRemainingTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) {
    return `${seconds}d`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}d`;
}

/**
 * Check if cooldown is active and return remaining time.
 */
function getCooldownRemaining(): number {
  if (typeof window === "undefined") return 0;

  const lastFetch = localStorage.getItem(COOLDOWN_KEY);
  if (!lastFetch) return 0;

  const lastFetchTime = parseInt(lastFetch, 10);
  if (isNaN(lastFetchTime)) return 0;

  const elapsed = Date.now() - lastFetchTime;
  const remaining = FETCH_COOLDOWN_MS - elapsed;

  return remaining > 0 ? remaining : 0;
}

/**
 * Save current timestamp to localStorage for cooldown tracking.
 */
function saveCooldownTimestamp(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
}

export function SyncButton({ period }: Readonly<SyncButtonProps>) {
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
    failedCount: sessionFailed,
  } = useAnalysis();
  const {
    status: autoFetchStatus,
    lastFetchResult,
    lastError,
    triggerFetchNow,
  } = useAutoFetch();

  const [isResetting, setIsResetting] = React.useState(false);
  const [cooldownRemaining, setCooldownRemaining] = React.useState<number>(0);
  const [manualFetchTriggered, setManualFetchTriggered] = React.useState(false);

  // Check cooldown on mount and update every second
  React.useEffect(() => {
    const checkCooldown = () => {
      setCooldownRemaining(getCooldownRemaining());
    };
    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Reset manual trigger flag after fetch completes
  React.useEffect(() => {
    if (manualFetchTriggered && (autoFetchStatus === "success" || autoFetchStatus === "error")) {
      const timeout = setTimeout(() => {
        setManualFetchTriggered(false);
      }, 4000);
      return () => clearTimeout(timeout);
    }
  }, [manualFetchTriggered, autoFetchStatus]);

  const kpiData = data?.kpiData;
  const failedCount = kpiData?.failedCount ?? 0;
  const pendingCount = kpiData?.pendingCount ?? 0;
  const decodePendingCount = kpiData?.decodePendingCount ?? 0;
  const totalArticles = kpiData?.totalArticles ?? 0;

  const hasFailures = failedCount > 0;
  const hasPending = pendingCount > 0;
  const hasDecodePending = decodePendingCount > 0;
  const needsAnalysis = hasFailures || hasPending || hasDecodePending;
  const isFetchActive = autoFetchStatus === "fetching" || autoFetchStatus === "decoding" || autoFetchStatus === "analyzing";
  const isCooldownActive = cooldownRemaining > 0;
  const isBusy = isProcessing || isResetting || isFetchActive;

  /**
   * Smart pipeline: determine what to do and run it.
   */
  async function handleSync() {
    if (isBusy) return;

    // If there are pending articles to analyze (failed, decode-pending, or analysis-pending),
    // run analyze-only (no cooldown needed).
    if (needsAnalysis) {
      try {
        // Reset failed articles first if any
        if (hasFailures) {
          setIsResetting(true);
          const res = await fetch("/api/news/retry", { method: "POST" });
          if (!res.ok) {
            const responseData = await res.json();
            console.error("Failed to reset articles:", responseData.error);
          }
          setIsResetting(false);

          await mutate(
            (key: string) => typeof key === "string" && key.startsWith(DASHBOARD_API_BASE),
            undefined,
            { revalidate: true },
          );
        }

        // Get fresh counts
        const freshRes = await fetch(`${DASHBOARD_API_BASE}?period=${period}`);
        const freshJson = await freshRes.json();
        const freshDecodePendingCount = freshJson.data?.kpiData?.decodePendingCount ?? 0;
        const freshPendingCount = freshJson.data?.kpiData?.pendingCount ?? 0;

        if (freshDecodePendingCount > 0 || freshPendingCount > 0) {
          startProcess(freshDecodePendingCount, freshPendingCount);
        }
      } catch (err) {
        console.error("Sync process error:", err);
        setIsResetting(false);
      }
      return;
    }

    // Nothing pending — run full pipeline (fetch → decode → analyze).
    // This requires cooldown to not be active.
    if (isCooldownActive) return;

    setManualFetchTriggered(true);
    saveCooldownTimestamp();
    setCooldownRemaining(FETCH_COOLDOWN_MS);
    await triggerFetchNow();
  }

  /**
   * Determine the button text based on current state.
   */
  function getButtonText(): string {
    // Active states
    if (isResetting) return "Mereset...";

    if (isFetchActive && manualFetchTriggered) {
      if (autoFetchStatus === "fetching") return "Mengambil berita...";
      if (autoFetchStatus === "decoding") return "Memproses URL...";
      if (autoFetchStatus === "analyzing") return "Menganalisis...";
    }

    if (isDecoding && decodeProgress) {
      const current = decodeProgress.decoded + decodeProgress.failed;
      return `Proses URL ${current}/${decodeProgress.total}`;
    }

    if (isAnalyzing) {
      return `Analisis ${sessionAnalyzed}/${sessionTotal}`;
    }

    // Post-action states (briefly shown)
    if (manualFetchTriggered && autoFetchStatus === "success") return "Selesai!";
    if (manualFetchTriggered && autoFetchStatus === "error") return "Coba lagi";

    // Idle states
    if (isCooldownActive && !needsAnalysis) {
      return `Jeda (${formatRemainingTime(cooldownRemaining)})`;
    }

    if (needsAnalysis) {
      const totalPending = failedCount + pendingCount + decodePendingCount;
      return `Analisis (${totalPending} tertunda)`;
    }

    if (totalArticles === 0) return "Ambil & Analisis";

    return "Ambil & Analisis";
  }

  /**
   * Determine subtext below the button.
   */
  function getSubtext(): { text: string; type: "info" | "warning" | "success" | "error" } | null {
    // Active states
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

    // Post-fetch results (shown briefly after manual trigger)
    if (manualFetchTriggered && autoFetchStatus === "error" && lastError) {
      return { text: lastError, type: "error" };
    }
    if (manualFetchTriggered && autoFetchStatus === "success" && lastFetchResult) {
      const { inserted, skipped, warnings } = lastFetchResult;
      let resultText: string;
      if (inserted === 0 && skipped > 0) {
        resultText = `Tidak ada berita baru (${skipped} sudah ada)`;
      } else if (inserted > 0) {
        const skippedText = skipped > 0 ? `, ${skipped} sudah ada` : "";
        resultText = `${inserted} berita baru${skippedText}`;
      } else {
        resultText = "Tidak ada berita ditemukan";
      }
      if (warnings.length > 0) {
        return { text: `${resultText}. ${warnings.length} peringatan`, type: "warning" };
      }
      return { text: resultText, type: inserted > 0 ? "success" : "info" };
    }

    // Idle states
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
    if (isCooldownActive) {
      return { text: `Jeda aktif. Coba lagi dalam ${formatRemainingTime(cooldownRemaining)}.`, type: "warning" };
    }
    if (totalArticles === 0) {
      return { text: "Belum ada artikel", type: "info" };
    }

    return { text: "Semua artikel teranalisis", type: "success" };
  }

  /**
   * Determine the button icon.
   */
  function getIcon() {
    if (isBusy || isResetting) {
      return <RiLoader4Line className="size-4 animate-spin" />;
    }
    if (manualFetchTriggered && autoFetchStatus === "success") {
      return <RiCheckLine className="size-4" />;
    }
    if (manualFetchTriggered && autoFetchStatus === "error") {
      return <RiErrorWarningLine className="size-4" />;
    }
    if (needsAnalysis) {
      return <RiSparklingLine className="size-4" />;
    }
    return <RiRefreshLine className="size-4" />;
  }

  /**
   * Determine the button variant.
   */
  function getVariant(): "primary" | "secondary" | "destructive" {
    if (manualFetchTriggered && autoFetchStatus === "error") return "destructive";
    if (needsAnalysis) return "secondary";
    return "primary";
  }

  // Button is disabled when busy OR when nothing to do and on cooldown
  const isDisabled = isBusy || (!needsAnalysis && isCooldownActive);
  const subtext = getSubtext();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={getVariant()}
        onClick={handleSync}
        disabled={isDisabled}
        className="gap-2"
      >
        {getIcon()}
        {getButtonText()}
      </Button>
      {subtext && (
        <p
          className={`max-w-[220px] text-right text-xs leading-tight ${
            subtext.type === "error"
              ? "text-red-500 dark:text-red-400"
              : subtext.type === "warning"
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
