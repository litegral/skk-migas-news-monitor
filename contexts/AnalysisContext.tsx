"use client";

/**
 * AnalysisContext provides background analysis state management.
 *
 * When analysis is started, it opens an SSE connection to /api/news/analyze/stream
 * and receives real-time progress updates as each article is processed.
 */

import React from "react";
import { useSWRConfig } from "swr";

/** SSE event data types */
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

interface AnalysisState {
  /** Whether analysis is currently running */
  isAnalyzing: boolean;
  /** Number of articles successfully analyzed in this session */
  analyzedCount: number;
  /** Number of articles that failed analysis in this session */
  failedCount: number;
  /** Total number of articles pending when analysis started */
  totalPending: number;
  /** Start background analysis via SSE stream */
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

  // Store EventSource reference for cleanup
  const eventSourceRef = React.useRef<EventSource | null>(null);

  const startAnalysis = React.useCallback(
    (pendingCount: number) => {
      if (isAnalyzing || pendingCount <= 0) return;

      // Reset state
      setIsAnalyzing(true);
      setAnalyzedCount(0);
      setFailedCount(0);
      setTotalPending(pendingCount);

      // Open SSE connection
      const eventSource = new EventSource("/api/news/analyze/stream");
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as SSEEvent;

          if (data.type === "progress") {
            setAnalyzedCount(data.analyzed);
            setFailedCount(data.failed);
            // Update total in case it differs from initial pendingCount
            if (data.total !== pendingCount) {
              setTotalPending(data.total);
            }
          }

          if (data.type === "complete") {
            setAnalyzedCount(data.analyzed);
            setFailedCount(data.failed);
            setIsAnalyzing(false);
            eventSource.close();
            eventSourceRef.current = null;

            // Revalidate dashboard data
            mutate("/api/dashboard");

            console.log(
              `[AnalysisContext] Analysis complete: ${data.analyzed} analyzed, ${data.failed} failed`
            );
          }

          if (data.type === "error") {
            console.error("[AnalysisContext] Server error:", data.message);
            setIsAnalyzing(false);
            eventSource.close();
            eventSourceRef.current = null;
          }
        } catch (err) {
          console.error("[AnalysisContext] Failed to parse SSE event:", err);
        }
      };

      eventSource.onerror = (event) => {
        console.error("[AnalysisContext] SSE connection error:", event);
        setIsAnalyzing(false);
        eventSource.close();
        eventSourceRef.current = null;

        // Revalidate dashboard data in case some articles were processed
        mutate("/api/dashboard");
      };
    },
    [isAnalyzing, mutate]
  );

  const stopAnalysis = React.useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsAnalyzing(false);

    // Revalidate dashboard data
    mutate("/api/dashboard");
  }, [mutate]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
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
