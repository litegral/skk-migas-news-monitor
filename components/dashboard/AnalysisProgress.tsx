"use client";

/**
 * AnalysisProgress displays live progress when background analysis is running.
 *
 * Shows: "Analyzing... 45/104 (3 failed)" with a stop button.
 * Only visible when isAnalyzing is true.
 */

import { RiLoader4Line, RiCloseLine } from "@remixicon/react";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { cx } from "@/lib/utils";

export function AnalysisProgress() {
  const { isAnalyzing, analyzedCount, failedCount, totalPending, stopAnalysis } =
    useAnalysis();

  if (!isAnalyzing) {
    return null;
  }

  const processed = analyzedCount + failedCount;

  return (
    <div
      className={cx(
        "flex items-center gap-2 rounded-lg border px-3 py-2",
        "border-blue-200 bg-blue-50 text-blue-700",
        "dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
      )}
    >
      {/* Spinner */}
      <RiLoader4Line className="size-4 animate-spin" />

      {/* Progress text */}
      <span className="text-sm font-medium">
        Analyzing... {processed}/{totalPending}
        {failedCount > 0 && (
          <span className="ml-1 text-amber-600 dark:text-amber-400">
            ({failedCount} failed)
          </span>
        )}
      </span>

      {/* Stop button */}
      <button
        type="button"
        onClick={stopAnalysis}
        className={cx(
          "ml-2 rounded-md p-1 transition-colors",
          "hover:bg-blue-100 dark:hover:bg-blue-900",
          "text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
        )}
        aria-label="Stop analysis"
        title="Stop analysis"
      >
        <RiCloseLine className="size-4" />
      </button>
    </div>
  );
}
