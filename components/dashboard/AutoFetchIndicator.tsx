"use client";

/**
 * AutoFetchIndicator displays a status dot that shows the auto-fetch state.
 * Clicking the dot opens a popover with more details.
 *
 * Dot states:
 * - Green (pulsing): Active, last fetch successful
 * - Blue (spinning): Currently fetching, decoding, or analyzing
 * - Yellow/Amber: Last fetch had an error (will retry)
 * - Gray: Initial state (no fetch yet)
 */

import React from "react";
import { RiRefreshLine } from "@remixicon/react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { Button } from "@/components/ui/Button";
import { useAutoFetch, type AutoFetchStatus } from "@/contexts/AutoFetchContext";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { cx } from "@/lib/utils";

/**
 * Format remaining time until next fetch
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
 * Get dot color classes based on status
 */
function getDotClasses(status: AutoFetchStatus): string {
  switch (status) {
    case "fetching":
    case "decoding":
    case "analyzing":
      return "bg-blue-500";
    case "success":
      return "bg-emerald-500";
    case "error":
      return "bg-amber-500";
    case "idle":
    default:
      return "bg-gray-400";
  }
}

/**
 * Get status badge text
 */
function getStatusText(status: AutoFetchStatus): string {
  switch (status) {
    case "fetching":
      return "Mengambil...";
    case "decoding":
      return "Memproses URL...";
    case "analyzing":
      return "Analisis...";
    case "success":
      return "Aktif";
    case "error":
      return "Error";
    case "idle":
    default:
      return "Idle";
  }
}

/**
 * Get status badge color classes
 */
function getStatusBadgeClasses(status: AutoFetchStatus): string {
  switch (status) {
    case "success":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "error":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "fetching":
    case "decoding":
    case "analyzing":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "idle":
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
  }
}

export function AutoFetchIndicator() {
  const {
    status,
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
  } = useAnalysis();

  const [isOpen, setIsOpen] = React.useState(false);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  // Update countdown every minute
  React.useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Combine auto-fetch status with manual processing status
  const isAutoFetchLoading = status === "fetching" || status === "decoding" || status === "analyzing";
  const isLoading = isAutoFetchLoading || isManualProcessing;

  // Use auto-fetch decode progress if auto-fetching, otherwise use manual decode progress
  const activeDecodeProgress = status === "decoding" ? autoFetchDecodeProgress : manualDecodeProgress;
  const isDecoding = status === "decoding" || isManualDecoding;
  const isAnalyzing = status === "analyzing" || isManualAnalyzing;

  const handleManualFetch = async () => {
    setIsOpen(false);
    await triggerFetchNow();
  };

  // Calculate progress text for inline display
  const getInlineProgressText = (): string | null => {
    if (status === "fetching") {
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
  };

  // Get effective status for display (prioritize manual processing)
  const getEffectiveStatus = (): AutoFetchStatus => {
    if (isManualDecoding) return "decoding";
    if (isManualAnalyzing) return "analyzing";
    return status;
  };

  const effectiveStatus = getEffectiveStatus();
  const inlineProgress = getInlineProgressText();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cx(
            "relative flex items-center gap-2 rounded-full px-2 py-1",
            "transition-colors hover:bg-gray-100 dark:hover:bg-gray-800",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          )}
          aria-label="Auto-fetch status"
        >
          {/* Progress text - visible when loading */}
          {inlineProgress && (
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
              {inlineProgress}
            </span>
          )}
          {/* Dot container with spinner */}
          <span className="relative flex size-6 items-center justify-center">
            {/* Outer ring for loading state */}
            {isLoading && (
              <span className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            )}
            {/* Status dot */}
            <span
              className={cx(
                "size-2.5 rounded-full",
                getDotClasses(effectiveStatus),
                !isLoading && effectiveStatus === "success" && "animate-pulse"
              )}
            />
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-3">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Auto-Fetch</span>
            <span
              className={cx(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                getStatusBadgeClasses(effectiveStatus)
              )}
            >
              {getStatusText(effectiveStatus)}
            </span>
          </div>

          {/* Details */}
          <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
            {/* Next fetch */}
            <div className="flex justify-between">
              <span>Berikutnya</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {nextFetchAt ? formatTimeUntil(nextFetchAt) : "-"}
              </span>
            </div>

            {/* Last fetch */}
            <div className="flex justify-between">
              <span>Terakhir</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {lastFetchAt
                  ? format(lastFetchAt, "HH:mm", { locale: id })
                  : "-"}
              </span>
            </div>

            {/* Result or error */}
            {lastError ? (
              <div className="flex justify-between">
                <span>Status</span>
                <span className="font-medium text-amber-600 dark:text-amber-400 truncate max-w-[120px]" title={lastError}>
                  Gagal
                </span>
              </div>
            ) : lastFetchResult ? (
              <div className="flex justify-between">
                <span>Hasil</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {lastFetchResult.inserted > 0
                    ? `+${lastFetchResult.inserted} artikel`
                    : "Tidak ada baru"}
                </span>
              </div>
            ) : null}

            {/* Decode progress - only show when decoding */}
            {isDecoding && activeDecodeProgress && activeDecodeProgress.total > 0 && (
              <div className="space-y-1.5 border-t border-gray-200 pt-2 dark:border-gray-800">
                <div className="flex justify-between">
                  <span>Memproses URL</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {activeDecodeProgress.decoded + activeDecodeProgress.failed}/{activeDecodeProgress.total}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
                    style={{
                      width: `${Math.round(((activeDecodeProgress.decoded + activeDecodeProgress.failed) / activeDecodeProgress.total) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Analysis progress - only show when analyzing */}
            {isAnalyzing && totalPending > 0 && (
              <div className="space-y-1.5 border-t border-gray-200 pt-2 dark:border-gray-800">
                <div className="flex justify-between">
                  <span>Analisis</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {analyzedCount + failedCount}/{totalPending} artikel
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${Math.round(((analyzedCount + failedCount) / totalPending) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Manual trigger button */}
          <Button
            variant="secondary"
            className="w-full gap-2"
            onClick={handleManualFetch}
            disabled={isLoading}
          >
            <RiRefreshLine className={cx("size-4", isLoading && "animate-spin")} />
            {isLoading ? "Sedang berjalan..." : "Ambil Sekarang"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
