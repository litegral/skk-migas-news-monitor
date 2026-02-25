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

import { Button } from "@/components/ui/Button";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { useAutoFetch } from "@/contexts/AutoFetchContext";
import { revalidateDashboardAction } from "@/app/actions/dashboard";

/** Cooldown duration: 5 minutes in milliseconds */
const FETCH_COOLDOWN_MS = 5 * 60 * 1000;

/** localStorage key for manual button cooldown */
const COOLDOWN_KEY = "skkmigas_lastNewsFetchTime";

export interface SyncButtonProps {
  failedCount: number;
  pendingCount: number;
  decodePendingCount: number;
  totalArticles: number;
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

export function SyncButton({
  failedCount = 0,
  pendingCount = 0,
  decodePendingCount = 0,
  totalArticles = 0
}: Readonly<SyncButtonProps>) {
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

  // Reset manual trigger flag after fetch completes and revalidate
  React.useEffect(() => {
    if (manualFetchTriggered && (autoFetchStatus === "success" || autoFetchStatus === "error")) {
      // Fetch is done, trigger server action to revalidate
      revalidateDashboardAction();

      const timeout = setTimeout(() => {
        setManualFetchTriggered(false);
      }, 4000);
      return () => clearTimeout(timeout);
    }
  }, [manualFetchTriggered, autoFetchStatus]);

  // Revalidate when processing finishes
  React.useEffect(() => {
    if (!isProcessing && !isResetting && !manualFetchTriggered && autoFetchStatus !== "fetching" && autoFetchStatus !== "decoding" && autoFetchStatus !== "analyzing") {
      // Only if we just finished processing something
      // we can't tell easily when it transitions from true to false unless we track previous state,
      // but typically AnalysisContext updates its state so we'll rely on calling revalidateDashboardAction
      // from within the contexts or doing it here when transition to idle happens.
      // Actually, AnalysisContext does not currently trigger revalidation.
      // We'll write a small prev value logic here.
    }
  }, [isProcessing, isResetting]);

  const prevProcessing = React.useRef(false);
  React.useEffect(() => {
    if (prevProcessing.current && !isProcessing) {
      revalidateDashboardAction();
    }
    prevProcessing.current = isProcessing;
  }, [isProcessing]);

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

    if (needsAnalysis) {
      try {
        if (hasFailures) {
          setIsResetting(true);
          const res = await fetch("/api/news/retry", { method: "POST" });
          if (!res.ok) {
            console.error("Failed to reset articles");
          }
          setIsResetting(false);
          await revalidateDashboardAction();
        }

        // We can just rely on the server action revalidation to get new stats,
        // but for immediate start we use the current UI pending counts.
        // Wait, resetting makes them pending again. We should wait for revalidation.

        // Let's just trigger startProcess with whatever we think is pending now.
        // If we just reset, failedCount becomes pending.
        const effectiveDecodePending = decodePendingCount;
        const effectivePending = hasFailures ? pendingCount + failedCount : pendingCount;

        if (effectiveDecodePending > 0 || effectivePending > 0) {
          startProcess(effectiveDecodePending, effectivePending);
        }
      } catch (err) {
        console.error("Sync process error:", err);
        setIsResetting(false);
      }
      return;
    }

    if (isCooldownActive) return;

    setManualFetchTriggered(true);
    saveCooldownTimestamp();
    setCooldownRemaining(FETCH_COOLDOWN_MS);
    await triggerFetchNow();
  }

  function getButtonText(): string {
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
    if (manualFetchTriggered && autoFetchStatus === "success") return "Selesai!";
    if (manualFetchTriggered && autoFetchStatus === "error") return "Coba lagi";
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

  function getSubtext(): { text: string; type: "info" | "warning" | "success" | "error" } | null {
    if (isResetting) return { text: "Mereset artikel yang gagal...", type: "info" };
    if (isDecoding) return { text: "Memproses URL Google News...", type: "info" };
    if (isAnalyzing) {
      if (sessionFailed > 0) return { text: `${sessionFailed} gagal sejauh ini`, type: "warning" };
      return { text: "Menganalisis artikel...", type: "info" };
    }
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
      if (warnings.length > 0) return { text: `${resultText}. ${warnings.length} peringatan`, type: "warning" };
      return { text: resultText, type: inserted > 0 ? "success" : "info" };
    }
    if (hasFailures) return { text: `${failedCount} gagal - Klik untuk coba lagi`, type: "warning" };
    if (hasDecodePending && hasPending) return { text: `${decodePendingCount} proses URL, ${pendingCount} siap analisis`, type: "info" };
    if (hasDecodePending) return { text: `${decodePendingCount} perlu proses URL dulu`, type: "info" };
    if (hasPending) return { text: `${pendingCount} siap dianalisis`, type: "info" };
    if (isCooldownActive) return { text: `Jeda aktif. Coba lagi dalam ${formatRemainingTime(cooldownRemaining)}.`, type: "warning" };
    if (totalArticles === 0) return { text: "Belum ada artikel", type: "info" };
    return { text: "Semua artikel teranalisis", type: "success" };
  }

  function getIcon() {
    if (isBusy || isResetting) return <RiLoader4Line className="size-4 animate-spin" />;
    if (manualFetchTriggered && autoFetchStatus === "success") return <RiCheckLine className="size-4" />;
    if (manualFetchTriggered && autoFetchStatus === "error") return <RiErrorWarningLine className="size-4" />;
    if (needsAnalysis) return <RiSparklingLine className="size-4" />;
    return <RiRefreshLine className="size-4" />;
  }

  function getVariant(): "primary" | "secondary" | "destructive" {
    if (manualFetchTriggered && autoFetchStatus === "error") return "destructive";
    if (needsAnalysis) return "secondary";
    return "primary";
  }

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
          className={`max-w-[220px] text-right text-xs leading-tight ${subtext.type === "error"
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
