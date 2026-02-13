/**
 * Dashboard Layout Types
 *
 * Defines the structure for customizable dashboard widget layout.
 * Users can drag to reorder widgets and resize them (sm/md/lg).
 */

/** Widget size presets - maps to CSS grid column spans */
export type WidgetSize = "sm" | "md" | "lg";

/** Configuration for a single widget */
export interface WidgetConfig {
  id: WidgetId;
  size: WidgetSize;
}

/** Complete dashboard layout (order determined by array position) */
export interface DashboardLayout {
  widgets: WidgetConfig[];
}

/** All available widget IDs */
export const WIDGET_IDS = [
  "kpi-total",
  "kpi-positive",
  "kpi-negative",
  "kpi-neutral",
  "sentiment-timeline",
  "sentiment-pie",
  "sources",
  "categories",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

/** Human-readable widget names (Indonesian) */
export const WIDGET_NAMES: Record<WidgetId, string> = {
  "kpi-total": "Total Artikel",
  "kpi-positive": "Berita Positif",
  "kpi-negative": "Berita Negatif",
  "kpi-neutral": "Berita Netral",
  "sentiment-timeline": "Tren Sentimen",
  "sentiment-pie": "Distribusi Sentimen",
  "sources": "Sumber Teratas",
  "categories": "Kategori",
};

/** Size labels for resize menu */
export const SIZE_LABELS: Record<WidgetSize, string> = {
  sm: "Kecil (1 kolom)",
  md: "Sedang (2 kolom)",
  lg: "Besar (4 kolom)",
};

/** Grid column span for each size */
export const SIZE_SPANS: Record<WidgetSize, number> = {
  sm: 1,
  md: 2,
  lg: 4,
};
