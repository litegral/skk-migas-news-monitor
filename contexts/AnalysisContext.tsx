"use client";

/**
 * AnalysisContext provides background analysis state management.
 *
 * When analysis is started, it loops calling /api/news/analyze until all
 * articles are processed. Progress is tracked and exposed to components
 * throughout the dashboard.
 */

import React from "react";
import { useSWRConfig } from "swr";

/** Batch size for each analyze API call */
const ANALYZE_BATCH_SIZE = 50;

interface AnalysisState {
  /** Whether analysis is currently running */
  isAnalyzing: boolean;
  /** Number of articles successfully analyzed in this session */
  analyzedCount: number;
  /** Number of articles that failed analysis in this session */
  failedCount: number;
  /** Total number of articles pending when analysis started */
  totalPending: number;
  /** Start background analysis loop */
  startAnalysis: (pendingCount: number) => void;
  /** Stop the current analysis */
  stopAnalysis: () => void;
}

const AnalysisContext = React.createContext<AnalysisState | null>(null);

interface AnalysisProviderProps {
  children: React.ReactNode;
}

export function AnalysisProvider({ children }: Readonly<AnalysisProviderProps>) {
  const { mutate } = useSWRConfig();

  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analyzedCount, setAnalyzedCount] = React.useState(0);
  const [failedCount, setFailedCount] = React.useState(0);
  const [totalPending, setTotalPending] = React.useState(0);

  // Use ref for abort flag to avoid stale closure issues
  const abortRef = React.useRef(false);

  const startAnalysis = React.useCallback(
    async (pendingCount: number) => {
      if (isAnalyzing || pendingCount <= 0) return;

      // Reset state
      abortRef.current = false;
      setIsAnalyzing(true);
      setAnalyzedCount(0);
      setFailedCount(0);
      setTotalPending(pendingCount);

      let remaining = pendingCount;
      let totalAnalyzed = 0;
      let totalFailed = 0;

      // Loop until all articles are processed or aborted
      while (remaining > 0 && !abortRef.current) {
        try {
          const res = await fetch("/api/news/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ limit: ANALYZE_BATCH_SIZE }),
          });

          if (!res.ok) {
            console.error("[AnalysisContext] API error:", res.status);
            break;
          }

          const json = await res.json();
          const data = json.data;

          if (!data) {
            console.error("[AnalysisContext] No data in response");
            break;
          }

          totalAnalyzed += data.analyzed ?? 0;
          totalFailed += data.failed ?? 0;
          remaining = data.remaining ?? 0;

          // Update state
          setAnalyzedCount(totalAnalyzed);
          setFailedCount(totalFailed);

          // If nothing was processed, we're done (or stuck)
          if ((data.analyzed ?? 0) === 0 && (data.failed ?? 0) === 0) {
            break;
          }

          // Trigger SWR revalidation for dashboard data
          mutate("/api/dashboard");
        } catch (err) {
          console.error("[AnalysisContext] Fetch error:", err);
          break;
        }
      }

      // Analysis complete
      setIsAnalyzing(false);

      // Final revalidation to ensure UI is up to date
      mutate("/api/dashboard");

      console.log(
        `[AnalysisContext] Analysis complete: ${totalAnalyzed} analyzed, ${totalFailed} failed`
      );
    },
    [isAnalyzing, mutate]
  );

  const stopAnalysis = React.useCallback(() => {
    abortRef.current = true;
    // isAnalyzing will be set to false when the loop detects abort
  }, []);

  const value = React.useMemo(
    () => ({
      isAnalyzing,
      analyzedCount,
      failedCount,
      totalPending,
      startAnalysis,
      stopAnalysis,
    }),
    [isAnalyzing, analyzedCount, failedCount, totalPending, startAnalysis, stopAnalysis]
  );

  return (
    <AnalysisContext.Provider value={value}>
      {children}
    </AnalysisContext.Provider>
  );
}

/**
 * Hook to access analysis state.
 * Must be used within an AnalysisProvider.
 */
export function useAnalysis(): AnalysisState {
  const context = React.useContext(AnalysisContext);
  if (!context) {
    throw new Error("useAnalysis must be used within an AnalysisProvider");
  }
  return context;
}
