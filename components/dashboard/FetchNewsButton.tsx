"use client";

/**
 * FetchNewsButton triggers fetching from Google News RSS and RSS feeds,
 * then starts background analysis via the AnalysisContext.
 *
 * Safeguards:
 * - Disabled while background analysis is running
 * - 5-minute cooldown between fetches (stored in localStorage)
 */

import React from "react";
import { RiRefreshLine, RiCheckLine, RiErrorWarningLine } from "@remixicon/react";
import { useSWRConfig } from "swr";

import { Button } from "@/components/ui/Button";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { DASHBOARD_API_BASE } from "@/lib/hooks/useDashboardData";

type FetchStep = "idle" | "googlenews" | "rss" | "done" | "error";

/** Cooldown duration: 5 minutes in milliseconds */
const FETCH_COOLDOWN_MS = 5 * 60 * 1000;

/** localStorage key for last fetch timestamp */
const LAST_FETCH_KEY = "skkmigas_lastNewsFetchTime";

const stepLabels: Record<FetchStep, string> = {
  idle: "Ambil Berita",
  googlenews: "Mengambil dari Google News...",
  rss: "Mengambil RSS feeds...",
  done: "Selesai!",
  error: "Terjadi kesalahan",
};

interface FetchNewsButtonProps {
  /** Callback when fetching state changes */
  onFetchingChange?: (isFetching: boolean) => void;
}

/**
 * Format remaining cooldown time as human-readable string.
 */
function formatRemainingTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Check if cooldown is active and return remaining time.
 * Returns 0 if cooldown has passed.
 */
function getCooldownRemaining(): number {
  if (typeof window === "undefined") return 0;

  const lastFetch = localStorage.getItem(LAST_FETCH_KEY);
  if (!lastFetch) return 0;

  const lastFetchTime = parseInt(lastFetch, 10);
  if (isNaN(lastFetchTime)) return 0;

  const elapsed = Date.now() - lastFetchTime;
  const remaining = FETCH_COOLDOWN_MS - elapsed;

  return remaining > 0 ? remaining : 0;
}

/**
 * Save current timestamp to localStorage.
 */
function saveFetchTimestamp(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_FETCH_KEY, Date.now().toString());
}

/** Result from a single fetch API call */
interface FetchApiResult {
  inserted: number;
  skipped: number;
}

export function FetchNewsButton({ onFetchingChange }: Readonly<FetchNewsButtonProps> = {}) {
  const { mutate } = useSWRConfig();
  const { startAnalysis, isAnalyzing } = useAnalysis();
  const [step, setStep] = React.useState<FetchStep>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = React.useState<number>(0);
  const [lastFetchResult, setLastFetchResult] = React.useState<FetchApiResult | null>(null);

  // Check cooldown on mount and update every second while active
  React.useEffect(() => {
    const checkCooldown = () => {
      const remaining = getCooldownRemaining();
      setCooldownRemaining(remaining);
    };

    // Initial check
    checkCooldown();

    // Update every second if cooldown is active
    const interval = setInterval(checkCooldown, 1000);

    return () => clearInterval(interval);
  }, []);

  const isLoading = step !== "idle" && step !== "done" && step !== "error";
  const isCooldownActive = cooldownRemaining > 0;
  const isDisabled = isLoading || isAnalyzing || isCooldownActive;

  // Notify parent when fetching state changes
  React.useEffect(() => {
    onFetchingChange?.(isLoading);
  }, [isLoading, onFetchingChange]);

  async function handleFetch() {
    // Double-check cooldown (in case button wasn't disabled fast enough)
    if (getCooldownRemaining() > 0) {
      return;
    }

    setStep("googlenews");
    setError(null);
    setLastFetchResult(null);

    let totalInserted = 0;
    let totalSkipped = 0;

    try {
      // Step 1: Fetch from Google News RSS
      const googleNewsRes = await fetch("/api/news/googlenews", { method: "POST" });
      if (!googleNewsRes.ok) {
        const data = await googleNewsRes.json();
        throw new Error(data.error || "Failed to fetch from Google News");
      }
      const googleNewsData = await googleNewsRes.json();
      totalInserted += googleNewsData.data?.inserted ?? 0;
      totalSkipped += googleNewsData.data?.skipped ?? 0;

      // Step 2: Fetch from RSS feeds
      setStep("rss");
      const rssRes = await fetch("/api/news/rss", { method: "POST" });
      if (!rssRes.ok) {
        const data = await rssRes.json();
        throw new Error(data.error || "Failed to fetch RSS feeds");
      }
      const rssData = await rssRes.json();
      totalInserted += rssData.data?.inserted ?? 0;
      totalSkipped += rssData.data?.skipped ?? 0;

      setStep("done");
      setLastFetchResult({ inserted: totalInserted, skipped: totalSkipped });

      // Save fetch timestamp for cooldown
      saveFetchTimestamp();
      setCooldownRemaining(FETCH_COOLDOWN_MS);

      // Refresh all dashboard data by invalidating any key that starts with DASHBOARD_API_BASE
      // This re-fetches data for all period variants
      await mutate(
        (key: string) => typeof key === "string" && key.startsWith(DASHBOARD_API_BASE),
        undefined,
        { revalidate: true }
      );

      // Fetch fresh dashboard data to get pending count
      const freshRes = await fetch(DASHBOARD_API_BASE);
      const freshJson = await freshRes.json();
      const freshPendingCount = freshJson.data?.pendingCount ?? 0;

      // Start background analysis if there are pending articles
      if (freshPendingCount > 0 && !isAnalyzing) {
        startAnalysis(freshPendingCount);
      }

      // Reset button after delay
      setTimeout(() => {
        setStep("idle");
      }, 1500);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setStep("error");

      // Reset after showing error
      setTimeout(() => {
        setStep("idle");
        setError(null);
      }, 3000);
    }
  }

  const getIcon = () => {
    switch (step) {
      case "done":
        return <RiCheckLine className="size-4" />;
      case "error":
        return <RiErrorWarningLine className="size-4" />;
      default:
        return <RiRefreshLine className={`size-4 ${isLoading ? "animate-spin" : ""}`} />;
    }
  };

  const getVariant = () => {
    switch (step) {
      case "done":
        return "primary" as const;
      case "error":
        return "destructive" as const;
      default:
        return "primary" as const;
    }
  };

  /**
   * Get the appropriate status message to display below the button.
   */
  const getStatusMessage = (): { text: string; type: "error" | "warning" | "info" | "success" } | null => {
    if (error) {
      return { text: error, type: "error" };
    }
    if (step === "done" && lastFetchResult) {
      const { inserted, skipped } = lastFetchResult;
      if (inserted === 0 && skipped > 0) {
        return { text: `Tidak ada berita baru (${skipped} sudah ada)`, type: "info" };
      }
      if (inserted > 0) {
        const skippedText = skipped > 0 ? `, ${skipped} sudah ada` : "";
        return { text: `${inserted} berita baru${skippedText}`, type: "success" };
      }
      return { text: "Tidak ada berita ditemukan", type: "info" };
    }
    if (isAnalyzing) {
      return { text: "Analisis sedang berlangsung. Mohon tunggu.", type: "info" };
    }
    if (isCooldownActive) {
      return {
        text: `Jeda aktif. Coba lagi dalam ${formatRemainingTime(cooldownRemaining)}.`,
        type: "warning",
      };
    }
    return null;
  };

  const statusMessage = getStatusMessage();

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant={getVariant()}
        onClick={handleFetch}
        disabled={isDisabled}
        className="gap-2"
      >
        {getIcon()}
        {stepLabels[step]}
      </Button>
      {statusMessage && (
        <p
          className={`text-xs ${
            statusMessage.type === "error"
              ? "text-red-500 dark:text-red-400"
              : statusMessage.type === "warning"
                ? "text-amber-600 dark:text-amber-400"
                : statusMessage.type === "success"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {statusMessage.text}
        </p>
      )}
    </div>
  );
}
