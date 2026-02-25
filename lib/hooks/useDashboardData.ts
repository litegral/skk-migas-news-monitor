/**
 * useDashboardData hook for fetching dashboard data with SWR.
 *
 * Provides reactive data fetching with automatic revalidation when
 * the AnalysisContext triggers mutations.
 */

import useSWR from "swr";
import type { DashboardData } from "@/app/api/dashboard/route";
import type { DashboardPeriod } from "@/lib/types/dashboard";
import { DEFAULT_PERIOD } from "@/lib/types/dashboard";

const DASHBOARD_API_BASE = "/api/dashboard";

async function fetcher(url: string): Promise<DashboardData> {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error("Failed to fetch dashboard data");
    throw error;
  }

  const json = await res.json();

  if (json.error) {
    throw new Error(json.error);
  }

  return json.data;
}

interface UseDashboardDataOptions {
  period?: DashboardPeriod;
  fallbackData?: DashboardData;
}

export function useDashboardData(options: UseDashboardDataOptions = {}) {
  const { period = DEFAULT_PERIOD, fallbackData } = options;

  // Build the SWR key with period parameter
  const swrKey = `${DASHBOARD_API_BASE}?period=${period}`;

  return useSWR<DashboardData>(swrKey, fetcher, {
    fallbackData,
    revalidateOnFocus: false,
    revalidateOnMount: false,
    revalidateIfStale: false,
    dedupingInterval: 5000,
    // Keep previous data while revalidating
    keepPreviousData: true,
  });
}

/** Export the base key for manual mutations */
export { DASHBOARD_API_BASE };
