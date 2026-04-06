"use client";

import React from "react";
import { RiInformationLine } from "@remixicon/react";

import { useAutoFetch } from "@/contexts/AutoFetchContext";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { formatTimeUntil } from "@/lib/utils/formatTimeUntil";
import { cx } from "@/lib/utils";

export interface PendingAnalysisNoticeProps {
  pendingCount: number;
  decodePendingCount: number;
}

export function PendingAnalysisNotice({
  pendingCount,
  decodePendingCount,
}: Readonly<PendingAnalysisNoticeProps>) {
  const {
    nextFetchAt,
    status: autoFetchStatus,
    decodeProgress: autoFetchDecodeProgress,
  } = useAutoFetch();
  const {
    isProcessing,
    totalPending,
    decodeProgress: manualDecodeProgress,
    isAnalyzing,
    isDecoding,
  } = useAnalysis();

  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const interval = setInterval(() => {
      tick();
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const total = pendingCount + decodePendingCount;
  if (total <= 0) return null;

  const isAutoBusy =
    autoFetchStatus === "fetching" ||
    autoFetchStatus === "decoding" ||
    autoFetchStatus === "analyzing";
  const pipelineBusy = isAutoBusy || isProcessing;

  const backlogPhrase = `${total} artikel menunggu dianalisis AI`;

  const activeDecodeProgress =
    autoFetchStatus === "decoding" ? autoFetchDecodeProgress : manualDecodeProgress;

  const firstLine = (() => {
    if (pipelineBusy) {
      if (
        (isAnalyzing || autoFetchStatus === "analyzing") &&
        totalPending > 0
      ) {
        return `${totalPending} artikel sedang dianalisis AI.`;
      }
      if (
        (isDecoding || autoFetchStatus === "decoding") &&
        activeDecodeProgress &&
        activeDecodeProgress.total > 0
      ) {
        return `${activeDecodeProgress.total} artikel sedang diproses.`;
      }
      if (autoFetchStatus === "fetching") {
        return "Sedang mengambil berita dari sumber…";
      }
      return `${total} artikel sedang diproses.`;
    }
    if (nextFetchAt) {
      return `${backlogPhrase} (~${formatTimeUntil(nextFetchAt)} hingga sinkronisasi otomatis berikutnya).`;
    }
    return `${backlogPhrase}.`;
  })();

  return (
    <div
      className={cx(
        "mt-3 flex gap-2 rounded-md border border-blue-200 bg-blue-50/90 p-3 text-sm",
        "text-blue-950 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-50/95",
      )}
      role="status"
    >
      <RiInformationLine
        className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400"
        aria-hidden
      />
      <div className="min-w-0 space-y-2 leading-snug">
        <p>{firstLine}</p>
        <p>
          Untuk memproses sekarang: buka menu sinkronisasi → ikon kanan atas → jalankan analisis.
          Atau atur sentimen manual dari setiap kartu artikel.
        </p>
      </div>
    </div>
  );
}
