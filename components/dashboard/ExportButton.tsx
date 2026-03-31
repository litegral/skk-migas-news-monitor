"use client";

/**
 * Export Button Component
 *
 * Dropdown button for exporting articles to Excel with date range options.
 * Fetches rows via server action (same filters as feed, full result set up to cap).
 */

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { RiFileExcel2Line, RiCalendarLine } from "@remixicon/react";
import { format, subDays, startOfMonth, endOfMonth, endOfDay, startOfDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { exportArticlesToExcel } from "@/lib/utils/exportExcel";
import {
  getArticlesForExportAction,
  type ArticlesExportQueryParams,
} from "@/app/actions/articles";

interface ExportButtonProps {
  /** Total matching articles in the feed (for enabling the button). */
  totalCount: number;
  /** Current feed filters — same as getFeedArticlesAction (without page/limit). */
  exportQuery: Omit<ArticlesExportQueryParams, "dateFrom" | "dateTo">;
  /** Map of topic ID → topic name for resolving matchedTopicIds */
  topicMap?: Record<string, string>;
}

/** Month option for dropdown */
interface MonthOption {
  label: string;
  start: Date;
  end: Date;
  key: string;
}

/**
 * Generates month options for the last N months.
 *
 * @param count - Number of months to generate.
 * @returns Array of month options with start/end dates.
 */
function generateMonthOptions(count: number): MonthOption[] {
  const months: MonthOption[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = format(date, "MMMM yyyy", { locale: idLocale });

    months.push({
      label: monthName.charAt(0).toUpperCase() + monthName.slice(1), // Capitalize first letter
      start: startOfMonth(date),
      end: endOfMonth(date),
      key: format(date, "yyyy-MM"),
    });
  }

  return months;
}

/**
 * Sanitizes a string for use in filename.
 *
 * @param str - String to sanitize.
 * @returns Sanitized string safe for filenames.
 */
function sanitizeFilename(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function ExportButton({
  totalCount,
  exportQuery,
  topicMap,
}: Readonly<ExportButtonProps>) {
  const [isExporting, setIsExporting] = useState(false);

  // Generate month options (last 6 months)
  const monthOptions = useMemo(() => generateMonthOptions(6), []);

  /**
   * Handles export with optional date filtering.
   *
   * @param startDate - Start date for filtering (null for no filter).
   * @param endDate - End date for filtering (null for no filter).
   * @param label - Label for the filename.
   */
  const handleExport = async (
    startDate: Date | null,
    endDate: Date | null,
    label: string
  ) => {
    setIsExporting(true);

    try {
      const base: Omit<ArticlesExportQueryParams, "dateFrom" | "dateTo"> = {
        search: exportQuery.search,
        sentiment: exportQuery.sentiment,
        topics: exportQuery.topics,
        categories: exportQuery.categories,
        sources: exportQuery.sources,
        sortBy: exportQuery.sortBy,
      };

      const payload: ArticlesExportQueryParams =
        startDate && endDate
          ? {
              ...base,
              dateFrom: startOfDay(startDate).toISOString(),
              dateTo: endOfDay(endDate).toISOString(),
            }
          : base;

      const { articles: articlesToExport, error } =
        await getArticlesForExportAction(payload);

      if (error) {
        console.error("[ExportButton] Export fetch failed:", error);
        return;
      }

      const filename = `berita-skk-migas-${sanitizeFilename(label)}`;
      await exportArticlesToExcel(articlesToExport, { filename, topicMap });
    } catch (error) {
      console.error("[ExportButton] Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const now = new Date();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          disabled={isExporting || totalCount === 0}
          className="gap-2"
        >
          <RiFileExcel2Line className="size-4" />
          {isExporting ? "Mengekspor..." : "Export Excel"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {/* Quick date ranges */}
        <DropdownMenuLabel>Rentang Cepat</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => handleExport(subDays(now, 7), now, "7-hari-terakhir")}
        >
          <RiCalendarLine className="mr-2 size-4 text-gray-500" />
          7 Hari Terakhir
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport(subDays(now, 30), now, "30-hari-terakhir")}
        >
          <RiCalendarLine className="mr-2 size-4 text-gray-500" />
          30 Hari Terakhir
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport(subDays(now, 90), now, "90-hari-terakhir")}
        >
          <RiCalendarLine className="mr-2 size-4 text-gray-500" />
          90 Hari Terakhir
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Monthly options */}
        <DropdownMenuLabel>Bulanan</DropdownMenuLabel>
        {monthOptions.map((month) => (
          <DropdownMenuItem
            key={month.key}
            onClick={() => handleExport(month.start, month.end, month.label)}
          >
            <RiCalendarLine className="mr-2 size-4 text-gray-500" />
            {month.label}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {/* Export all */}
        <DropdownMenuItem
          onClick={() => handleExport(null, null, "semua-artikel")}
        >
          <RiFileExcel2Line className="mr-2 size-4 text-gray-500" />
          Semua Artikel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
