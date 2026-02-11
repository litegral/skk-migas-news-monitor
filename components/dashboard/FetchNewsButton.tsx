"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { RiRefreshLine, RiCheckLine, RiErrorWarningLine } from "@remixicon/react";

import { Button } from "@/components/ui/Button";

type FetchStep = "idle" | "rapidapi" | "rss" | "analyze" | "done" | "error";

const stepLabels: Record<FetchStep, string> = {
  idle: "Fetch News",
  rapidapi: "Fetching from RapidAPI...",
  rss: "Fetching RSS feeds...",
  analyze: "Analyzing articles...",
  done: "Done!",
  error: "Error occurred",
};

export function FetchNewsButton() {
  const router = useRouter();
  const [step, setStep] = React.useState<FetchStep>("idle");
  const [error, setError] = React.useState<string | null>(null);

  const isLoading = step !== "idle" && step !== "done" && step !== "error";

  async function handleFetch() {
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

      // Step 3: Analyze unprocessed articles
      setStep("analyze");
      const analyzeRes = await fetch("/api/news/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 20 }),
      });
      if (!analyzeRes.ok) {
        const data = await analyzeRes.json();
        throw new Error(data.error || "Failed to analyze articles");
      }

      setStep("done");

      // Refresh the page data after a short delay
      setTimeout(() => {
        router.refresh();
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

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant={getVariant()}
        onClick={handleFetch}
        disabled={isLoading}
        className="gap-2"
      >
        {getIcon()}
        {stepLabels[step]}
      </Button>
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
