/**
 * Export to Excel Utility
 *
 * Generates professionally formatted Excel files from article data.
 * Uses ExcelJS library for full styling support including:
 * - Header row with colors and bold text
 * - Proper Excel date formatting
 * - Clickable URL hyperlinks
 * - Column width optimization
 */

import ExcelJS from "exceljs";
import { format } from "date-fns";
import type { Article } from "@/lib/types/news";

/** Options for Excel export */
interface ExportOptions {
  /** Custom filename (without extension) */
  filename?: string;
  /** Sheet name in the Excel file */
  sheetName?: string;
}

/** Column definitions for the Excel sheet */
const COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: "No", key: "no", width: 6 },
  { header: "Judul", key: "judul", width: 60 },
  { header: "Sumber", key: "sumber", width: 20 },
  { header: "Tanggal", key: "tanggal", width: 14 },
  { header: "Positif", key: "positif", width: 9 },
  { header: "Netral", key: "netral", width: 9 },
  { header: "Negatif", key: "negatif", width: 9 },
  { header: "URL", key: "url", width: 50 },
  { header: "Ringkasan", key: "ringkasan", width: 80 },
];

/** Header row styling */
const HEADER_STYLE: Partial<ExcelJS.Style> = {
  fill: {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A5F" }, // Dark blue
  },
  font: {
    bold: true,
    color: { argb: "FFFFFFFF" }, // White
    size: 11,
  },
  alignment: {
    vertical: "middle",
    horizontal: "center",
  },
  border: {
    top: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  },
};

/** Hyperlink style for URL column */
const HYPERLINK_FONT: Partial<ExcelJS.Font> = {
  color: { argb: "FF0066CC" },
  underline: true,
};

/**
 * Parses a date string to a Date object.
 *
 * @param dateStr - ISO date string or null.
 * @returns Date object or null if invalid.
 */
function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

/**
 * Exports articles to an Excel file and triggers download.
 * This is an async function due to ExcelJS's buffer generation.
 *
 * @param articles - Array of articles to export.
 * @param options - Export options (filename, sheetName).
 */
export async function exportArticlesToExcel(
  articles: Article[],
  options: ExportOptions = {}
): Promise<void> {
  const {
    filename = `berita-skk-migas-${format(new Date(), "yyyy-MM-dd")}`,
    sheetName = "Berita",
  } = options;

  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SKK Migas News Monitor";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }], // Freeze header row
  });

  // Set up columns
  worksheet.columns = COLUMNS;

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.style = HEADER_STYLE;
  });

  // Add data rows
  articles.forEach((article, index) => {
    const date = parseDate(article.publishedAt);

    const row = worksheet.addRow({
      no: index + 1,
      judul: article.title,
      sumber: article.sourceName || "-",
      tanggal: date, // Pass Date object for proper Excel formatting
      positif: article.sentiment === "positive" ? "✓" : "",
      netral: article.sentiment === "neutral" ? "✓" : "",
      negatif: article.sentiment === "negative" ? "✓" : "",
      url: article.link,
      ringkasan: article.summary || article.snippet || "-",
    });

    // Style data row
    row.eachCell((cell, colNumber) => {
      // Default border for all cells
      cell.border = {
        top: { style: "thin", color: { argb: "FFE0E0E0" } },
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
        left: { style: "thin", color: { argb: "FFE0E0E0" } },
        right: { style: "thin", color: { argb: "FFE0E0E0" } },
      };

      // Column-specific styling
      switch (colNumber) {
        case 1: // No column - right align
          cell.alignment = { horizontal: "center", vertical: "middle" };
          break;
        case 2: // Judul - left align, wrap text
          cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
          break;
        case 4: // Tanggal - format as date
          if (date) {
            cell.numFmt = "DD MMM YYYY";
          } else {
            cell.value = "-";
          }
          cell.alignment = { horizontal: "center", vertical: "middle" };
          break;
        case 5: // Positif
        case 6: // Netral
        case 7: // Negatif - center align checkmarks
          cell.alignment = { horizontal: "center", vertical: "middle" };
          if (cell.value === "✓") {
            // Color code sentiment checkmarks
            if (colNumber === 5) {
              cell.font = { color: { argb: "FF16A34A" } }; // Green for positive
            } else if (colNumber === 6) {
              cell.font = { color: { argb: "FF6B7280" } }; // Gray for neutral
            } else {
              cell.font = { color: { argb: "FFDC2626" } }; // Red for negative
            }
          }
          break;
        case 8: // URL - add hyperlink
          if (article.link) {
            cell.value = {
              text: article.link,
              hyperlink: article.link,
            };
            cell.font = HYPERLINK_FONT;
          }
          cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
          break;
        case 9: // Ringkasan - wrap text
          cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
          break;
        default:
          cell.alignment = { horizontal: "left", vertical: "middle" };
      }
    });

    // Set row height based on content (minimum 20, allow auto-grow)
    row.height = 20;
  });

  // Alternate row colors for better readability
  for (let i = 2; i <= articles.length + 1; i++) {
    const row = worksheet.getRow(i);
    if (i % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" }, // Light gray
        };
      });
    }
  }

  // Generate buffer and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  // Create download link and trigger
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Filters articles by date range.
 *
 * @param articles - Array of articles to filter.
 * @param startDate - Start date (inclusive).
 * @param endDate - End date (inclusive).
 * @returns Filtered articles within the date range.
 */
export function filterArticlesByDateRange(
  articles: Article[],
  startDate: Date,
  endDate: Date
): Article[] {
  return articles.filter((article) => {
    if (!article.publishedAt) return false;
    const date = new Date(article.publishedAt);
    if (isNaN(date.getTime())) return false;
    return date >= startDate && date <= endDate;
  });
}
