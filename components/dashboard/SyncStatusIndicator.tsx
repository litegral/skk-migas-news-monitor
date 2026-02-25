"use client";

/**
 * SyncStatusIndicator — unified status dot with popover.
 *
 * Replaces AnalysisProgress + AutoFetchIndicator.
 * Shows a colored dot that reflects the current pipeline state,
 * with inline progress text when active.
 * Clicking opens a popover with detailed status, progress bars,
 * auto-fetch schedule, last results, and a stop button.
 */

import React from "react";
import {
  RiCloseLine,
  RiRefreshLine,
  RiTimeLine,
  RiCheckLine,
  RiErrorWarningLine,
} from "@remixicon/react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { Button } from "@/components/ui/Button";
import { useAutoFetch } from "@/contexts/AutoFetchContext";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { cx } from "@/lib/utils";

/**
 * Format remaining time until a date.
 */
function formatTimeUntil(date: Date): string {
  const now = Date.now();
  const target = date.getTime();
  const diff = target - now;

  if (diff <= 0) return "Sekarang";

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours} jam ${remainingMinutes} menit`;
  }
  return `${minutes} menit`;
}

/**
 * Effective status combining auto-fetch and manual processing.
 */
type EffectiveStatus = "idle" | "fetching" | "decoding" | "analyzing" | "success" | "error";

export function SyncStatusIndicator() {
  const {
    status: autoFetchStatus,
    lastFetchAt,
    lastFetchResult,
    lastError,
    nextFetchAt,
    decodeProgress: autoFetchDecodeProgress,
    triggerFetchNow,
  } = useAutoFetch();

  const {
    isProcessing: isManualProcessing,
    isDecoding: isManualDecoding,
    isAnalyzing: isManualAnalyzing,
    decodeProgress: manualDecodeProgress,
    analyzedCount,
    failedCount,
    totalPending,
    stopProcess,
  } = useAnalysis();

  const [isOpen, setIsOpen] = React.useState(false);
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

  // Update countdown every minute
  React.useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Combine auto-fetch and manual processing status
  const isAutoFetchLoading =
    autoFetchStatus === "fetching" ||
    autoFetchStatus === "decoding" ||
    autoFetchStatus === "analyzing";
  const isLoading = isAutoFetchLoading || isManualProcessing;

  // Active decode progress (auto-fetch vs manual)
  const activeDecodeProgress =
    autoFetchStatus === "decoding" ? autoFetchDecodeProgress : manualDecodeProgress;
  const isDecoding = autoFetchStatus === "decoding" || isManualDecoding;
  const isAnalyzing = autoFetchStatus === "analyzing" || isManualAnalyzing;

  /**
   * Get effective status for display (manual processing takes priority).
   */
  function getEffectiveStatus(): EffectiveStatus {
    if (isManualDecoding) return "decoding";
    if (isManualAnalyzing) return "analyzing";
    return autoFetchStatus;
  }

  const effectiveStatus = getEffectiveStatus();

  /**
   * Get dot color based on effective status.
   */
  function getDotColor(): string {
    switch (effectiveStatus) {
      case "fetching":
      case "decoding":
      case "analyzing":
        return "bg-blue-500";
      case "success":
        return "bg-emerald-500";
      case "error":
        return "bg-amber-500";
      default:
        return "bg-gray-400";
    }
  }

  /**
   * Get inline progress text (shown next to the dot).
   */
  function getInlineProgressText(): string | null {
    if (autoFetchStatus === "fetching") {
      return "Mengambil...";
    }
    if (isDecoding && activeDecodeProgress && activeDecodeProgress.total > 0) {
      const current = activeDecodeProgress.decoded + activeDecodeProgress.failed;
      return `URL ${current}/${activeDecodeProgress.total}`;
    }
    if (isAnalyzing && totalPending > 0) {
      const current = analyzedCount + failedCount;
      return `Analisis ${current}/${totalPending}`;
    }
    return null;
  }

  /**
   * Get status badge text for the popover.
   */
  function getStatusText(): string {
    switch (effectiveStatus) {
      case "fetching":
        return "Mengambil...";
      case "decoding":
        return "Memproses URL...";
      case "analyzing":
        return "Menganalisis...";
      case "success":
        return "Aktif";
      case "error":
        return "Error";
      default:
        return "Idle";
    }
  }

  /**
   * Get status badge color classes.
   */
  function getStatusBadgeClasses(): string {
    switch (effectiveStatus) {
      case "success":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "error":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "fetching":
      case "decoding":
      case "analyzing":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    }
  }

  /**
   * Can the user stop the current operation?
   */
  const canStop = isManualProcessing;

  /**
   * Handle stop — stop manual processing.
   */
  function handleStop() {
    stopProcess();
  }

  /**
   * Handle manual fetch trigger from popover.
   */
  async function handleManualFetch() {
    setIsOpen(false);
    await triggerFetchNow();
  }

  const inlineProgress = getInlineProgressText();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cx(
            "relative flex items-center gap-2 rounded-full px-2 py-1",
            "transition-colors hover:bg-gray-100 dark:hover:bg-gray-800",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          )}
          aria-label="Sync status"
        >
          {/* Inline progress text */}
          {inlineProgress && (
            <span className="whitespace-nowrap text-xs font-medium text-blue-600 dark:text-blue-400">
              {inlineProgress}
            </span>
          )}
          {/* Dot container */}
          <span className="relative flex size-6 items-center justify-center">
            {/* Spinner ring when loading */}
            {isLoading && (
              <span className="absolute inset-0 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            )}
            {/* Status dot */}
            <span
              className={cx(
                "size-2.5 rounded-full",
                getDotColor(),
                !isLoading && effectiveStatus === "success" && "animate-pulse",
              )}
            />
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-3">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status Sinkronisasi</span>
            <span
              className={cx(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                getStatusBadgeClasses(),
              )}
            >
              {getStatusText()}
            </span>
          </div>

          {/* Detail rows */}
          <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
            {/* Next auto-fetch */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <RiTimeLine className="size-3" />
                Berikutnya
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {nextFetchAt ? formatTimeUntil(nextFetchAt) : "-"}
              </span>
            </div>

            {/* Last fetch */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <RiRefreshLine className="size-3" />
                Terakhir
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {lastFetchAt
                  ? format(lastFetchAt, "HH:mm", { locale: id })
                  : "-"}
              </span>
            </div>

            {/* Last result or error */}
            {lastError ? (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <RiErrorWarningLine className="size-3 text-amber-500" />
                  Status
                </span>
                <span
                  className="max-w-[130px] truncate font-medium text-amber-600 dark:text-amber-400"
                  title={lastError}
                >
                  Gagal
                </span>
              </div>
            ) : lastFetchResult ? (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <RiCheckLine className="size-3 text-emerald-500" />
                  Hasil
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {lastFetchResult.inserted > 0
                    ? `+${lastFetchResult.inserted} artikel`
                    : "Tidak ada baru"}
                </span>
              </div>
            ) : null}

            {/* Warnings */}
            {lastFetchResult && lastFetchResult.warnings.length > 0 && (
              <div className="space-y-1 border-t border-amber-200 pt-1.5 dark:border-amber-900/40">
                {lastFetchResult.warnings.map((w, i) => (
                  <p
                    key={i}
                    className="leading-tight text-amber-600 dark:text-amber-400"
                  >
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Decode progress bar */}
          {isDecoding && activeDecodeProgress && activeDecodeProgress.total > 0 && (
            <div className="space-y-1.5 border-t border-gray-200 pt-2 dark:border-gray-800">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">
                  Memproses URL
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {activeDecodeProgress.decoded + activeDecodeProgress.failed}/
                  {activeDecodeProgress.total}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${Math.round(
                      ((activeDecodeProgress.decoded + activeDecodeProgress.failed) /
                        activeDecodeProgress.total) *
                        100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Analysis progress bar */}
          {isAnalyzing && totalPending > 0 && (
            <div className="space-y-1.5 border-t border-gray-200 pt-2 dark:border-gray-800">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">
                  Analisis
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {analyzedCount + failedCount}/{totalPending} artikel
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${Math.round(
                      ((analyzedCount + failedCount) / totalPending) * 100,
                    )}%`,
                  }}
                />
              </div>
              {/* Failed count during analysis */}
              {failedCount > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {failedCount} gagal
                </p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 border-t border-gray-200 pt-2 dark:border-gray-800">
            {canStop ? (
              <Button
                variant="secondary"
                className="w-full gap-2"
                onClick={handleStop}
              >
                <RiCloseLine className="size-4" />
                Hentikan
              </Button>
            ) : (
              <Button
                variant="secondary"
                className="w-full gap-2"
                onClick={handleManualFetch}
                disabled={isLoading}
              >
                <RiRefreshLine
                  className={cx("size-4", isLoading && "animate-spin")}
                />
                {isLoading ? "Sedang berjalan..." : "Ambil Sekarang"}
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
