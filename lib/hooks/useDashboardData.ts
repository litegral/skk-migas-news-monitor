/**
 * useDashboardData hook for fetching dashboard data with SWR.
 *
 * Provides reactive data fetching with automatic revalidation when
 * the AnalysisContext triggers mutations.
 */

import useSWR from "swr";
import type { DashboardData } from "@/app/api/dashboard/route";

const DASHBOARD_API_KEY = "/api/dashboard";

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

export function useDashboardData(fallbackData?: DashboardData) {
  return useSWR<DashboardData>(DASHBOARD_API_KEY, fetcher, {
    fallbackData,
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    // Keep previous data while revalidating
    keepPreviousData: true,
  });
}

/** Export the key for manual mutations */
export { DASHBOARD_API_KEY };
