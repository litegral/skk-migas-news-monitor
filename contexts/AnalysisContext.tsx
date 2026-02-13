"use client";

/**
 * AnalysisContext provides background analysis state management.
 *
 * When analysis is started, it:
 * 1. First runs URL decode if there are decode-pending articles
 * 2. Then runs AI analysis on decoded articles
 *
 * Both phases use SSE connections for real-time progress updates.
 */

import React from "react";
import { useSWRConfig } from "swr";
import { DASHBOARD_API_BASE } from "@/lib/hooks/useDashboardData";

/** SSE event data types for analysis */
interface SSEProgressEvent {
  type: "progress";
  analyzed: number;
  failed: number;
  total: number;
}

interface SSECompleteEvent {
  type: "complete";
  analyzed: number;
  failed: number;
  total: number;
}

interface SSEErrorEvent {
  type: "error";
  message: string;
}

type SSEEvent = SSEProgressEvent | SSECompleteEvent | SSEErrorEvent;

/** Decode progress tracking */
interface DecodeProgress {
  decoded: number;
  failed: number;
  total: number;
}

/** Current phase of the process */
type ProcessPhase = "idle" | "decoding" | "analyzing";

interface AnalysisState {
  /** Current processing phase */
  phase: ProcessPhase;
  /** Whether any processing is running (decode or analyze) */
  isProcessing: boolean;
  /** Whether analysis is currently running (legacy compat) */
  isAnalyzing: boolean;
  /** Whether decode is currently running */
  isDecoding: boolean;
  /** Decode progress (when phase === "decoding") */
  decodeProgress: DecodeProgress | null;
  /** Number of articles successfully analyzed in this session */
  analyzedCount: number;
  /** Number of articles that failed analysis in this session */
  failedCount: number;
  /** Total number of articles pending when analysis started */
  totalPending: number;
  /** Start the full process: decode (if needed) → analyze */
  startProcess: (decodePendingCount: number, analysisPendingCount: number) => void;
  /** Start background analysis via SSE stream (legacy, skips decode) */
  startAnalysis: (pendingCount: number) => void;
  /** Stop the current process */
  stopProcess: () => void;
  /** Stop the current analysis (legacy alias) */
  stopAnalysis: () => void;
}

const AnalysisContext = React.createContext<AnalysisState | null>(null);

interface AnalysisProviderProps {
  children: React.ReactNode;
}

export function AnalysisProvider({ children }: Readonly<AnalysisProviderProps>) {
  const { mutate } = useSWRConfig();

  const [phase, setPhase] = React.useState<ProcessPhase>("idle");
  const [decodeProgress, setDecodeProgress] = React.useState<DecodeProgress | null>(null);
  const [analyzedCount, setAnalyzedCount] = React.useState(0);
  const [failedCount, setFailedCount] = React.useState(0);
  const [totalPending, setTotalPending] = React.useState(0);

  // Store EventSource references for cleanup
  const decodeEventSourceRef = React.useRef<EventSource | null>(null);
  const analyzeEventSourceRef = React.useRef<EventSource | null>(null);

  // Derived state
  const isDecoding = phase === "decoding";
  const isAnalyzing = phase === "analyzing";
  const isProcessing = phase !== "idle";

  /**
   * Run URL decoding via SSE stream
   * Returns a promise that resolves when decoding is complete
   */
  const runDecodeStream = React.useCallback((): Promise<DecodeProgress> => {
    return new Promise((resolve) => {
      console.log("[AnalysisContext] Starting URL decode stream...");
      const eventSource = new EventSource("/api/news/decode/stream");
      decodeEventSourceRef.current = eventSource;

      let finalResult: DecodeProgress = { decoded: 0, failed: 0, total: 0 };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "progress") {
            const progress = {
              decoded: data.decoded,
              failed: data.failed,
              total: data.total,
            };
            setDecodeProgress(progress);
            finalResult = progress;
            console.log(`[AnalysisContext] Decode progress: ${data.decoded + data.failed}/${data.total}`);
          }

          if (data.type === "complete") {
            finalResult = { decoded: data.decoded, failed: data.failed, total: data.total };
            setDecodeProgress(finalResult);
            eventSource.close();
            decodeEventSourceRef.current = null;
            console.log(`[AnalysisContext] Decode complete: ${data.decoded} decoded, ${data.failed} failed`);
            resolve(finalResult);
          }

          if (data.type === "error") {
            console.error("[AnalysisContext] Decode error:", data.message);
            eventSource.close();
            decodeEventSourceRef.current = null;
            resolve(finalResult);
          }
        } catch (err) {
          console.error("[AnalysisContext] Failed to parse decode SSE event:", err);
        }
      };

      eventSource.onerror = () => {
        console.error("[AnalysisContext] Decode SSE connection error");
        eventSource.close();
        decodeEventSourceRef.current = null;
        // Resolve with whatever progress we have - don't fail the whole flow
        resolve(finalResult);
      };
    });
  }, []);

  /**
   * Run analysis via SSE stream
   * Returns a promise that resolves when analysis is complete
   */
  const runAnalyzeStream = React.useCallback((pendingCount: number): Promise<void> => {
    return new Promise((resolve) => {
      console.log(`[AnalysisContext] Starting analysis stream for ${pendingCount} articles...`);
      
      // Reset analysis state
      setAnalyzedCount(0);
      setFailedCount(0);
      setTotalPending(pendingCount);

      const eventSource = new EventSource("/api/news/analyze/stream");
      analyzeEventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as SSEEvent;

          if (data.type === "progress") {
            setAnalyzedCount(data.analyzed);
            setFailedCount(data.failed);
            if (data.total !== pendingCount) {
              setTotalPending(data.total);
            }
            console.log(`[AnalysisContext] Analysis progress: ${data.analyzed + data.failed}/${data.total}`);
          }

          if (data.type === "complete") {
            setAnalyzedCount(data.analyzed);
            setFailedCount(data.failed);
            eventSource.close();
            analyzeEventSourceRef.current = null;
            console.log(`[AnalysisContext] Analysis complete: ${data.analyzed} analyzed, ${data.failed} failed`);
            resolve();
          }

          if (data.type === "error") {
            console.error("[AnalysisContext] Analysis error:", data.message);
            eventSource.close();
            analyzeEventSourceRef.current = null;
            resolve();
          }
        } catch (err) {
          console.error("[AnalysisContext] Failed to parse analysis SSE event:", err);
        }
      };

      eventSource.onerror = (event) => {
        console.error("[AnalysisContext] Analysis SSE connection error:", event);
        eventSource.close();
        analyzeEventSourceRef.current = null;
        resolve();
      };
    });
  }, []);

  /**
   * Revalidate dashboard data
   */
  const revalidateDashboard = React.useCallback(() => {
    mutate(
      (key: string) => typeof key === "string" && key.startsWith(DASHBOARD_API_BASE),
      undefined,
      { revalidate: true }
    );
  }, [mutate]);

  /**
   * Start the full process: decode (if needed) → analyze
   */
  const startProcess = React.useCallback(
    async (decodePendingCount: number, analysisPendingCount: number) => {
      if (isProcessing) {
        console.log("[AnalysisContext] Already processing, skipping");
        return;
      }

      // Nothing to do
      if (decodePendingCount <= 0 && analysisPendingCount <= 0) {
        console.log("[AnalysisContext] No articles to process");
        return;
      }

      try {
        // Phase 1: Decode (if needed)
        if (decodePendingCount > 0) {
          console.log(`[AnalysisContext] Phase 1: Decoding ${decodePendingCount} URLs...`);
          setPhase("decoding");
          setDecodeProgress({ decoded: 0, failed: 0, total: decodePendingCount });

          await runDecodeStream();

          // Refresh dashboard to get updated counts
          revalidateDashboard();

          // Wait a bit for the dashboard data to refresh
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Get fresh pending count for analysis
        const freshRes = await fetch(`${DASHBOARD_API_BASE}?period=1m`);
        const freshJson = await freshRes.json();
        const freshPendingCount = freshJson.data?.kpiData?.pendingCount ?? 0;

        // Phase 2: Analyze (if there are pending articles)
        if (freshPendingCount > 0) {
          console.log(`[AnalysisContext] Phase 2: Analyzing ${freshPendingCount} articles...`);
          setPhase("analyzing");

          await runAnalyzeStream(freshPendingCount);

          // Refresh dashboard after analysis
          revalidateDashboard();
        } else {
          console.log("[AnalysisContext] No articles ready for analysis");
        }
      } catch (err) {
        console.error("[AnalysisContext] Process error:", err);
      } finally {
        setPhase("idle");
      }
    },
    [isProcessing, runDecodeStream, runAnalyzeStream, revalidateDashboard]
  );

  /**
   * Legacy: Start analysis only (skips decode)
   */
  const startAnalysis = React.useCallback(
    (pendingCount: number) => {
      if (isProcessing || pendingCount <= 0) return;

      setPhase("analyzing");
      runAnalyzeStream(pendingCount).then(() => {
        setPhase("idle");
        revalidateDashboard();
      });
    },
    [isProcessing, runAnalyzeStream, revalidateDashboard]
  );

  /**
   * Stop all processing
   */
  const stopProcess = React.useCallback(() => {
    if (decodeEventSourceRef.current) {
      decodeEventSourceRef.current.close();
      decodeEventSourceRef.current = null;
    }
    if (analyzeEventSourceRef.current) {
      analyzeEventSourceRef.current.close();
      analyzeEventSourceRef.current = null;
    }
    setPhase("idle");
    revalidateDashboard();
  }, [revalidateDashboard]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (decodeEventSourceRef.current) {
        decodeEventSourceRef.current.close();
        decodeEventSourceRef.current = null;
      }
      if (analyzeEventSourceRef.current) {
        analyzeEventSourceRef.current.close();
        analyzeEventSourceRef.current = null;
      }
    };
  }, []);

  const value = React.useMemo(
    () => ({
      phase,
      isProcessing,
      isAnalyzing,
      isDecoding,
      decodeProgress,
      analyzedCount,
      failedCount,
      totalPending,
      startProcess,
      startAnalysis,
      stopProcess,
      stopAnalysis: stopProcess, // Legacy alias
    }),
    [
      phase,
      isProcessing,
      isAnalyzing,
      isDecoding,
      decodeProgress,
      analyzedCount,
      failedCount,
      totalPending,
      startProcess,
      startAnalysis,
      stopProcess,
    ]
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
