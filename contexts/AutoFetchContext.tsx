"use client";

/**
 * AutoFetchContext provides automatic news fetching on a schedule.
 *
 * Features:
 * - Fetches news every 1 hour automatically
 * - Decodes Google News URLs in background (3s delays to avoid rate limits)
 * - Triggers AI analysis after URL decoding completes
 * - Handles browser visibility changes (catches missed fetches)
 * - Persists last fetch time to localStorage
 * - Continues on error (resilient)
 *
 * Flow:
 *   1. Fetch (fast) → Store articles with Google News URLs
 *   2. Decode (background) → Convert to actual article URLs
 *   3. Analyze (background) → Crawl + LLM analysis
 */

import React from "react";
import { useSWRConfig } from "swr";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { DASHBOARD_API_BASE } from "@/lib/hooks/useDashboardData";

/** Auto-fetch interval: 1 hour */
const FETCH_INTERVAL_MS = 60 * 60 * 1000;

/** Minimum gap between fetches to prevent duplicates: 55 minutes */
const MIN_FETCH_GAP_MS = 55 * 60 * 1000;

/** localStorage key for last fetch timestamp */
const STORAGE_KEY = "skkmigas-auto-fetch-last";

export type AutoFetchStatus =
  | "idle"
  | "fetching"
  | "decoding"
  | "analyzing"
  | "success"
  | "error";

interface FetchResult {
  inserted: number;
  skipped: number;
  errors: number;
}

interface DecodeProgress {
  decoded: number;
  failed: number;
  total: number;
}

interface AutoFetchContextValue {
  /** Current status of auto-fetch */
  status: AutoFetchStatus;
  /** Timestamp of last successful fetch */
  lastFetchAt: Date | null;
  /** Result of last fetch (articles inserted/skipped) */
  lastFetchResult: FetchResult | null;
  /** Error message if last fetch failed */
  lastError: string | null;
  /** Timestamp of next scheduled fetch */
  nextFetchAt: Date | null;
  /** Decode progress (when status === "decoding") */
  decodeProgress: DecodeProgress | null;
  /** Manually trigger a fetch now */
  triggerFetchNow: () => Promise<void>;
}

const AutoFetchContext = React.createContext<AutoFetchContextValue | null>(null);

interface AutoFetchProviderProps {
  children: React.ReactNode;
}

export function AutoFetchProvider({ children }: Readonly<AutoFetchProviderProps>) {
  const { mutate } = useSWRConfig();
  const { startAnalysis, isAnalyzing } = useAnalysis();

  const [status, setStatus] = React.useState<AutoFetchStatus>("idle");
  const [lastFetchAt, setLastFetchAt] = React.useState<Date | null>(null);
  const [lastFetchResult, setLastFetchResult] = React.useState<FetchResult | null>(null);
  const [lastError, setLastError] = React.useState<string | null>(null);
  const [nextFetchAt, setNextFetchAt] = React.useState<Date | null>(null);
  const [decodeProgress, setDecodeProgress] = React.useState<DecodeProgress | null>(null);

  // Track if currently fetching to prevent concurrent fetches
  const isFetchingRef = React.useRef(false);
  // Track EventSource for cleanup
  const decodeEventSourceRef = React.useRef<EventSource | null>(null);

  /**
   * Load last fetch time from localStorage on mount
   */
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const timestamp = parseInt(stored, 10);
        if (!isNaN(timestamp)) {
          setLastFetchAt(new Date(timestamp));
          // Calculate next fetch time
          setNextFetchAt(new Date(timestamp + FETCH_INTERVAL_MS));
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  /**
   * Save last fetch time to localStorage
   */
  const saveLastFetchTime = React.useCallback((date: Date) => {
    try {
      localStorage.setItem(STORAGE_KEY, date.getTime().toString());
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  /**
   * Run URL decoding via SSE stream
   * Returns a promise that resolves when decoding is complete
   */
  const runDecodeStream = React.useCallback((): Promise<DecodeProgress> => {
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource("/api/news/decode/stream");
      decodeEventSourceRef.current = eventSource;

      let finalResult: DecodeProgress = { decoded: 0, failed: 0, total: 0 };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "progress") {
            setDecodeProgress({
              decoded: data.decoded,
              failed: data.failed,
              total: data.total,
            });
            finalResult = { decoded: data.decoded, failed: data.failed, total: data.total };
          }

          if (data.type === "complete") {
            finalResult = { decoded: data.decoded, failed: data.failed, total: data.total };
            setDecodeProgress(finalResult);
            eventSource.close();
            decodeEventSourceRef.current = null;
            resolve(finalResult);
          }

          if (data.type === "error") {
            eventSource.close();
            decodeEventSourceRef.current = null;
            reject(new Error(data.message));
          }
        } catch (err) {
          console.error("[AutoFetch] Failed to parse decode SSE event:", err);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        decodeEventSourceRef.current = null;
        // Resolve with whatever progress we have - don't fail the whole flow
        resolve(finalResult);
      };
    });
  }, []);

  /**
   * Core fetch function - now includes decode phase
   */
  const performFetch = React.useCallback(async (): Promise<void> => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log("[AutoFetch] Fetch already in progress, skipping");
      return;
    }

    // Check minimum gap
    if (lastFetchAt) {
      const elapsed = Date.now() - lastFetchAt.getTime();
      if (elapsed < MIN_FETCH_GAP_MS) {
        console.log("[AutoFetch] Too soon since last fetch, skipping");
        return;
      }
    }

    isFetchingRef.current = true;
    setStatus("fetching");
    setLastError(null);
    setDecodeProgress(null);

    let totalInserted = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    try {
      // ========== PHASE 1: FETCH (fast) ==========
      console.log("[AutoFetch] Phase 1: Fetching news...");

      // Step 1a: Fetch from Google News RSS
      console.log("[AutoFetch] Fetching from Google News...");
      const googleNewsRes = await fetch("/api/news/googlenews", { method: "POST" });
      if (!googleNewsRes.ok) {
        const data = await googleNewsRes.json();
        throw new Error(data.error || "Failed to fetch from Google News");
      }
      const googleNewsData = await googleNewsRes.json();
      totalInserted += googleNewsData.data?.inserted ?? 0;
      totalSkipped += googleNewsData.data?.skipped ?? 0;
      totalErrors += googleNewsData.data?.errors?.length ?? 0;

      // Step 1b: Fetch from RSS feeds
      console.log("[AutoFetch] Fetching from RSS feeds...");
      const rssRes = await fetch("/api/news/rss", { method: "POST" });
      if (!rssRes.ok) {
        const data = await rssRes.json();
        throw new Error(data.error || "Failed to fetch RSS feeds");
      }
      const rssData = await rssRes.json();
      totalInserted += rssData.data?.inserted ?? 0;
      totalSkipped += rssData.data?.skipped ?? 0;
      totalErrors += rssData.data?.errors?.length ?? 0;

      // Update state after fetch
      const now = new Date();
      setLastFetchAt(now);
      setLastFetchResult({ inserted: totalInserted, skipped: totalSkipped, errors: totalErrors });
      setNextFetchAt(new Date(now.getTime() + FETCH_INTERVAL_MS));
      saveLastFetchTime(now);

      console.log(`[AutoFetch] Phase 1 complete: ${totalInserted} inserted, ${totalSkipped} skipped`);

      // Refresh dashboard data
      await mutate(
        (key: string) => typeof key === "string" && key.startsWith(DASHBOARD_API_BASE),
        undefined,
        { revalidate: true }
      );

      // ========== PHASE 2: DECODE (background, 3s delays) ==========
      console.log("[AutoFetch] Phase 2: Decoding URLs...");
      setStatus("decoding");

      const decodeResult = await runDecodeStream();
      console.log(
        `[AutoFetch] Phase 2 complete: ${decodeResult.decoded} decoded, ${decodeResult.failed} failed`
      );

      // Refresh dashboard data after decode
      await mutate(
        (key: string) => typeof key === "string" && key.startsWith(DASHBOARD_API_BASE),
        undefined,
        { revalidate: true }
      );

      // ========== PHASE 3: ANALYZE (background) ==========
      if (!isAnalyzing) {
        setStatus("analyzing");

        // Fetch fresh dashboard data to get pending count
        const freshRes = await fetch(DASHBOARD_API_BASE);
        const freshJson = await freshRes.json();
        const pendingCount = freshJson.data?.pendingCount ?? 0;

        if (pendingCount > 0) {
          console.log(`[AutoFetch] Phase 3: Starting analysis for ${pendingCount} pending articles`);
          startAnalysis(pendingCount);
        } else {
          console.log("[AutoFetch] Phase 3: No pending articles to analyze");
          setStatus("success");
        }
      } else {
        console.log("[AutoFetch] Analysis already running, skipping auto-analyze");
        setStatus("success");
      }
    } catch (err) {
      console.error("[AutoFetch] Fetch error:", err);
      setLastError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");

      // Still update next fetch time so we continue the schedule
      const now = new Date();
      setNextFetchAt(new Date(now.getTime() + FETCH_INTERVAL_MS));
    } finally {
      isFetchingRef.current = false;
    }
  }, [lastFetchAt, mutate, isAnalyzing, startAnalysis, saveLastFetchTime, runDecodeStream]);

  /**
   * Check if we should fetch (on mount or visibility change)
   */
  const checkAndFetch = React.useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // Never fetched before, fetch now
        console.log("[AutoFetch] No previous fetch found, fetching now");
        performFetch();
        return;
      }

      const lastFetchTime = parseInt(stored, 10);
      if (isNaN(lastFetchTime)) {
        performFetch();
        return;
      }

      const elapsed = Date.now() - lastFetchTime;
      if (elapsed >= FETCH_INTERVAL_MS) {
        console.log("[AutoFetch] Missed fetch detected, fetching now");
        performFetch();
      }
    } catch {
      // Ignore errors, will try on next interval
    }
  }, [performFetch]);

  /**
   * Initial check on mount - fetch if needed
   */
  React.useEffect(() => {
    // Small delay to let the app settle
    const timeout = setTimeout(() => {
      checkAndFetch();
    }, 2000);

    return () => clearTimeout(timeout);
  }, [checkAndFetch]);

  /**
   * Set up the interval for periodic fetching
   */
  React.useEffect(() => {
    const interval = setInterval(() => {
      console.log("[AutoFetch] Interval triggered");
      performFetch();
    }, FETCH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [performFetch]);

  /**
   * Handle visibility changes - check for missed fetches when tab becomes visible
   */
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("[AutoFetch] Tab became visible, checking for missed fetches");
        checkAndFetch();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [checkAndFetch]);

  /**
   * Update status when analysis completes
   */
  React.useEffect(() => {
    if (status === "analyzing" && !isAnalyzing) {
      setStatus("success");
    }
  }, [status, isAnalyzing]);

  /**
   * Cleanup EventSource on unmount
   */
  React.useEffect(() => {
    return () => {
      if (decodeEventSourceRef.current) {
        decodeEventSourceRef.current.close();
        decodeEventSourceRef.current = null;
      }
    };
  }, []);

  /**
   * Manual trigger function
   */
  const triggerFetchNow = React.useCallback(async () => {
    // Reset the minimum gap check for manual triggers
    await performFetch();
  }, [performFetch]);

  const value = React.useMemo(
    () => ({
      status,
      lastFetchAt,
      lastFetchResult,
      lastError,
      nextFetchAt,
      decodeProgress,
      triggerFetchNow,
    }),
    [status, lastFetchAt, lastFetchResult, lastError, nextFetchAt, decodeProgress, triggerFetchNow]
  );

  return (
    <AutoFetchContext.Provider value={value}>
      {children}
    </AutoFetchContext.Provider>
  );
}

/**
 * Hook to access auto-fetch state.
 * Must be used within an AutoFetchProvider.
 */
export function useAutoFetch(): AutoFetchContextValue {
  const context = React.useContext(AutoFetchContext);
  if (!context) {
    throw new Error("useAutoFetch must be used within an AutoFetchProvider");
  }
  return context;
}
