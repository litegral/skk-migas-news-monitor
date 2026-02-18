"use client";

/**
 * FetchNewsButton — thin UI wrapper over AutoFetchContext.
 *
 * All fetch logic (Google News, RSS, URL decode, analysis) lives in
 * AutoFetchContext. This component just provides a button with:
 * - Visual feedback (spinner, check, error icons)
 * - 5-minute cooldown between manual fetches
 * - Status messages (inserted/skipped counts, warnings)
 * - `onFetchingChange` callback for parent components
 */

import React from "react";
import { RiRefreshLine, RiCheckLine, RiErrorWarningLine } from "@remixicon/react";

import { Button } from "@/components/ui/Button";
import { useAutoFetch, type AutoFetchStatus } from "@/contexts/AutoFetchContext";

/** Cooldown duration: 5 minutes in milliseconds */
const FETCH_COOLDOWN_MS = 5 * 60 * 1000;

/** localStorage key for manual button cooldown */
const COOLDOWN_KEY = "skkmigas_lastNewsFetchTime";

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

/**
 * Derive a simple button display state from the context status.
 */
type ButtonDisplay = "idle" | "loading" | "done" | "error";

function getButtonDisplay(status: AutoFetchStatus): ButtonDisplay {
  switch (status) {
    case "fetching":
    case "decoding":
    case "analyzing":
      return "loading";
    case "success":
      return "done";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

const buttonLabels: Record<ButtonDisplay, string> = {
  idle: "Ambil Berita",
  loading: "Mengambil berita...",
  done: "Selesai!",
  error: "Terjadi kesalahan",
};

export function FetchNewsButton({ onFetchingChange }: Readonly<FetchNewsButtonProps> = {}) {
  const { status, lastFetchResult, lastError, triggerFetchNow } = useAutoFetch();

  const [cooldownRemaining, setCooldownRemaining] = React.useState<number>(0);
  // Track whether the user manually triggered this fetch (for showing results)
  const [manuallyTriggered, setManuallyTriggered] = React.useState(false);

  // Check cooldown on mount and update every second while active
  React.useEffect(() => {
    const checkCooldown = () => {
      const remaining = getCooldownRemaining();
      setCooldownRemaining(remaining);
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, []);

  const display = getButtonDisplay(status);
  const isLoading = display === "loading";
  const isCooldownActive = cooldownRemaining > 0;
  const isDisabled = isLoading || isCooldownActive;

  // Notify parent when fetching state changes
  React.useEffect(() => {
    onFetchingChange?.(isLoading);
  }, [isLoading, onFetchingChange]);

  // Reset manuallyTriggered after the fetch pipeline finishes (success or error)
  React.useEffect(() => {
    if (manuallyTriggered && (status === "success" || status === "error")) {
      const timeout = setTimeout(() => {
        setManuallyTriggered(false);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [manuallyTriggered, status]);

  async function handleFetch() {
    if (getCooldownRemaining() > 0) return;

    setManuallyTriggered(true);

    // Start cooldown immediately so the user can't spam-click
    saveCooldownTimestamp();
    setCooldownRemaining(FETCH_COOLDOWN_MS);

    await triggerFetchNow();
  }

  const getIcon = () => {
    if (manuallyTriggered && display === "done") {
      return <RiCheckLine className="size-4" />;
    }
    if (manuallyTriggered && display === "error") {
      return <RiErrorWarningLine className="size-4" />;
    }
    return <RiRefreshLine className={`size-4 ${isLoading ? "animate-spin" : ""}`} />;
  };

  const getVariant = () => {
    if (manuallyTriggered && display === "error") {
      return "destructive" as const;
    }
    return "primary" as const;
  };

  /**
   * Get the label to show on the button.
   * Only show step-specific labels when the user manually triggered the fetch.
   * When auto-fetch is running in background, just show disabled "Ambil Berita".
   */
  const getLabel = (): string => {
    if (manuallyTriggered) {
      return buttonLabels[display];
    }
    if (isLoading) {
      // Auto-fetch is running in background — keep "Ambil Berita" but button is disabled
      return buttonLabels.idle;
    }
    return buttonLabels.idle;
  };

  /**
   * Get the appropriate status message to display below the button.
   * Only shows results when the user manually triggered the fetch.
   */
  const getStatusMessage = (): { text: string; type: "error" | "warning" | "info" | "success" } | null => {
    // Show error from manual trigger
    if (manuallyTriggered && display === "error" && lastError) {
      return { text: lastError, type: "error" };
    }

    // Show results from manual trigger
    if (manuallyTriggered && display === "done" && lastFetchResult) {
      const { inserted, skipped, warnings } = lastFetchResult;
      const hasWarnings = warnings.length > 0;

      let resultText: string;
      if (inserted === 0 && skipped > 0) {
        resultText = `Tidak ada berita baru (${skipped} sudah ada)`;
      } else if (inserted > 0) {
        const skippedText = skipped > 0 ? `, ${skipped} sudah ada` : "";
        resultText = `${inserted} berita baru${skippedText}`;
      } else {
        resultText = "Tidak ada berita ditemukan";
      }

      if (hasWarnings) {
        const warningText = warnings.length === 1 ? warnings[0] : `${warnings.length} peringatan`;
        return { text: `${resultText}. Peringatan: ${warningText}`, type: "warning" };
      }

      return { text: resultText, type: inserted > 0 ? "success" : "info" };
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
        {getLabel()}
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
