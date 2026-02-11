"use client";

/**
 * FetchNewsButton triggers fetching from RapidAPI and RSS feeds,
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
import { DASHBOARD_API_KEY } from "@/lib/hooks/useDashboardData";

type FetchStep = "idle" | "rapidapi" | "rss" | "done" | "error";

/** Cooldown duration: 5 minutes in milliseconds */
const FETCH_COOLDOWN_MS = 5 * 60 * 1000;

/** localStorage key for last fetch timestamp */
const LAST_FETCH_KEY = "skkmigas_lastNewsFetchTime";

const stepLabels: Record<FetchStep, string> = {
  idle: "Fetch News",
  rapidapi: "Fetching from RapidAPI...",
  rss: "Fetching RSS feeds...",
  done: "Done!",
  error: "Error occurred",
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

export function FetchNewsButton({ onFetchingChange }: Readonly<FetchNewsButtonProps> = {}) {
  const { mutate } = useSWRConfig();
  const { startAnalysis, isAnalyzing } = useAnalysis();
  const [step, setStep] = React.useState<FetchStep>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = React.useState<number>(0);

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

    setStep("rapidapi");
    setError(null);

    try {
      // Step 1: Fetch from RapidAPI
      const rapidApiRes = await fetch("/api/news/rapidapi", { method: "POST" });
      if (!rapidApiRes.ok) {
        const data = await rapidApiRes.json();
        throw new Error(data.error || "Failed to fetch from RapidAPI");
      }

      // Step 2: Fetch from RSS feeds
      setStep("rss");
      const rssRes = await fetch("/api/news/rss", { method: "POST" });
      if (!rssRes.ok) {
        const data = await rssRes.json();
        throw new Error(data.error || "Failed to fetch RSS feeds");
      }

      setStep("done");

      // Save fetch timestamp for cooldown
      saveFetchTimestamp();
      setCooldownRemaining(FETCH_COOLDOWN_MS);

      // Refresh dashboard data to get updated pending count
      const dashboardData = await mutate(DASHBOARD_API_KEY);

      // Start background analysis if there are pending articles
      if (dashboardData?.pendingCount && dashboardData.pendingCount > 0 && !isAnalyzing) {
        startAnalysis(dashboardData.pendingCount);
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
  const getStatusMessage = (): { text: string; type: "error" | "warning" | "info" } | null => {
    if (error) {
      return { text: error, type: "error" };
    }
    if (isAnalyzing) {
      return { text: "Analysis in progress. Please wait.", type: "info" };
    }
    if (isCooldownActive) {
      return {
        text: `Cooldown active. Try again in ${formatRemainingTime(cooldownRemaining)}.`,
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
                : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {statusMessage.text}
        </p>
      )}
    </div>
  );
}
