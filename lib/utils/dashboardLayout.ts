/**
 * Dashboard Layout Utilities
 *
 * Handles localStorage persistence for user's custom dashboard layout.
 */

import type { DashboardLayout, WidgetConfig, WidgetId } from "@/lib/types/dashboard-layout";
import { WIDGET_IDS } from "@/lib/types/dashboard-layout";

const STORAGE_KEY = "skkmigas-dashboard-layout";
const CATEGORY_WIDTH_MIGRATION_KEY = "skkmigas-dashboard-category-width-v1";

/** Default widget layout */
export const DEFAULT_LAYOUT: DashboardLayout = {
  widgets: [
    { id: "kpi-total", size: "sm" },
    { id: "kpi-positive", size: "sm" },
    { id: "kpi-negative", size: "sm" },
    { id: "kpi-neutral", size: "sm" },
    { id: "sentiment-timeline", size: "lg" },
    { id: "sentiment-pie", size: "md" },
    { id: "sources", size: "md" },
    { id: "categories", size: "md" },
    { id: "topic-watch", size: "md" },
  ],
};

/**
 * Validate and repair a layout to ensure all widgets are present.
 * Adds missing widgets with default sizes, removes unknown widgets.
 */
function validateLayout(layout: DashboardLayout): DashboardLayout {
  const existingIds = new Set(layout.widgets.map((w) => w.id));
  const validWidgets: WidgetConfig[] = [];

  // Keep valid existing widgets in order
  for (const widget of layout.widgets) {
    if (WIDGET_IDS.includes(widget.id as WidgetId)) {
      validWidgets.push(widget);
    }
  }

  // Add any missing widgets at the end with default sizes
  for (const defaultWidget of DEFAULT_LAYOUT.widgets) {
    if (!existingIds.has(defaultWidget.id)) {
      validWidgets.push({ ...defaultWidget });
    }
  }

  return { widgets: validWidgets };
}

/**
 * Load dashboard layout from localStorage.
 * Returns default layout if nothing is stored or if stored data is invalid.
 */
export function loadDashboardLayout(): DashboardLayout {
  if (typeof window === "undefined") {
    return DEFAULT_LAYOUT;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(CATEGORY_WIDTH_MIGRATION_KEY, "1");
      return DEFAULT_LAYOUT;
    }

    const parsed = JSON.parse(stored) as DashboardLayout;
    if (!parsed.widgets || !Array.isArray(parsed.widgets)) {
      return DEFAULT_LAYOUT;
    }

    const validated = validateLayout(parsed);

    // Apply the denser monitor layout once without preventing later user resizing.
    if (!localStorage.getItem(CATEGORY_WIDTH_MIGRATION_KEY)) {
      const migrated = {
        widgets: validated.widgets.map((widget) =>
          widget.id === "categories" ? { ...widget, size: "md" as const } : widget,
        ),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      localStorage.setItem(CATEGORY_WIDTH_MIGRATION_KEY, "1");
      return migrated;
    }

    return validated;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

/**
 * Save dashboard layout to localStorage.
 */
export function saveDashboardLayout(layout: DashboardLayout): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch (err) {
    console.error("[dashboardLayout] Failed to save layout:", err);
  }
}

/**
 * Reset dashboard layout to default and return it.
 */
export function resetDashboardLayout(): DashboardLayout {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  return DEFAULT_LAYOUT;
}
