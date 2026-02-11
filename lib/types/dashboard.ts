/**
 * Dashboard-related types.
 */

/** Period options for filtering dashboard data */
export type DashboardPeriod = "7d" | "1m" | "3m" | "6m" | "1y" | "all";

/** Period option for display */
export interface PeriodOption {
  value: DashboardPeriod;
  label: string;
  days: number | null; // null = all time
}

/** Available period options */
export const PERIOD_OPTIONS: PeriodOption[] = [
  { value: "7d", label: "7 Hari", days: 7 },
  { value: "1m", label: "1 Bulan", days: 30 },
  { value: "3m", label: "3 Bulan", days: 90 },
  { value: "6m", label: "6 Bulan", days: 180 },
  { value: "1y", label: "1 Tahun", days: 365 },
  { value: "all", label: "Semua", days: null },
];

/** Default period for dashboard */
export const DEFAULT_PERIOD: DashboardPeriod = "3m";

/**
 * Get the cutoff date for a given period.
 * Returns null if period is "all".
 */
export function getPeriodCutoffDate(period: DashboardPeriod): Date | null {
  const option = PERIOD_OPTIONS.find((p) => p.value === period);
  if (!option || option.days === null) {
    return null;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - option.days);
  return cutoff;
}

/**
 * Get the label for a period value.
 */
export function getPeriodLabel(period: DashboardPeriod): string {
  const option = PERIOD_OPTIONS.find((p) => p.value === period);
  return option?.label ?? period;
}
