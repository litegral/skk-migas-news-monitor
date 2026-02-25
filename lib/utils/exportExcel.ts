/**
 * Export to Excel Utility
 *
 * Generates professionally formatted Excel files from article data.
 * Uses ExcelJS library for full styling support including:
 * - Header row with colors and bold text
 * - Proper Excel date formatting
 * - Clickable URL hyperlinks
 * - Column width optimization
 * - Auto-fit row height based on content
 * - Topics column showing matched topic names
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
  /** Map of topic ID → topic name for resolving matchedTopicIds */
  topicMap?: Record<string, string>;
}

/** Column definitions for the Excel sheet */
const COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: "No", key: "no", width: 6 },
  { header: "Judul", key: "judul", width: 60 },
  { header: "Topik", key: "topik", width: 30 },
  { header: "Sumber", key: "sumber", width: 20 },
  { header: "Tanggal", key: "tanggal", width: 14 },
  { header: "Positif", key: "positif", width: 9 },
  { header: "Netral", key: "netral", width: 9 },
  { header: "Negatif", key: "negatif", width: 9 },
  { header: "URL", key: "url", width: 50 },
  { header: "Ringkasan", key: "ringkasan", width: 80 },
];

/** Column widths for height calculation (1-indexed, matching COLUMNS) */
const COLUMN_WIDTHS = [6, 60, 30, 20, 14, 9, 9, 9, 50, 80];

/** Header row styling */
const HEADER_STYLE: Partial<ExcelJS.Style> = {
  fill: {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A5F" },
  },
  font: {
    bold: true,
    color: { argb: "FFFFFFFF" },
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

/** Approximate character width per Excel column width unit */
const CHAR_WIDTH_FACTOR = 1.2;

/** Height per line of text in pixels */
const LINE_HEIGHT_PX = 16;

/** Minimum row height */
const MIN_ROW_HEIGHT = 20;

/** Maximum row height */
const MAX_ROW_HEIGHT = 250;

/**
 * Calculates the number of lines needed for text given a column width.
 *
 * @param text - Text content.
 * @param columnWidth - Excel column width.
 * @returns Estimated number of lines.
 */
function estimateLineCount(text: string | null | undefined, columnWidth: number): number {
  if (!text) return 1;

  // Count explicit newlines
  const explicitNewlines = (text.match(/\n/g) || []).length;

  // Estimate characters per line based on column width
  const charsPerLine = Math.max(1, Math.floor(columnWidth * CHAR_WIDTH_FACTOR));

  // Estimate wrapped lines (ignoring explicit newlines for now)
  const textWithoutNewlines = text.replace(/\n/g, " ");
  const wrappedLines = Math.ceil(textWithoutNewlines.length / charsPerLine);

  // Total lines = max of explicit lines or wrapped lines
  return Math.max(1, wrappedLines, explicitNewlines + 1);
}

/**
 * Calculates row height based on title only.
 * This ensures the title is always fully visible without wasted space.
 *
 * @param article - Article with title.
 * @returns Calculated row height in pixels.
 */
function calculateRowHeight(article: Article): number {
  const titleLines = estimateLineCount(article.title, COLUMN_WIDTHS[1]);
  const height = titleLines * LINE_HEIGHT_PX;
  return Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, height));
}

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
 * @param options - Export options (filename, sheetName, topicMap).
 */
export async function exportArticlesToExcel(
  articles: Article[],
  options: ExportOptions = {}
): Promise<void> {
  const {
    filename = `berita-skk-migas-${format(new Date(), "yyyy-MM-dd")}`,
    sheetName = "Berita",
    topicMap = {},
  } = options;

  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SKK Migas Kalsul News Monitor";
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

    // Resolve topic IDs to names
    const topicNames = article.matchedTopicIds
      ?.map((id) => topicMap[id])
      .filter(Boolean)
      .join(", ") || "-";

    const row = worksheet.addRow({
      no: index + 1,
      judul: article.title,
      topik: topicNames,
      sumber: article.sourceName || "-",
      tanggal: date,
      positif: article.sentiment === "positive" ? "✓" : "",
      netral: article.sentiment === "neutral" ? "✓" : "",
      negatif: article.sentiment === "negative" ? "✓" : "",
      url: article.decodedUrl || article.link,
      ringkasan: article.summary || article.snippet || "-",
    });

    row.height = calculateRowHeight(article);

    // Style data row
    row.eachCell((cell, colNumber) => {
      // Default border for all cells
      cell.border = {
        top: { style: "thin", color: { argb: "FFE0E0E0" } },
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
        left: { style: "thin", color: { argb: "FFE0E0E0" } },
        right: { style: "thin", color: { argb: "FFE0E0E0" } },
      };

      // Column-specific styling (updated column indices)
      switch (colNumber) {
        case 1: // No column - center align
          cell.alignment = { horizontal: "center", vertical: "top" };
          break;
        case 2: // Judul - left align, wrap text, top align
          cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
          break;
        case 3: // Topik - left align, wrap text
          cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
          break;
        case 4: // Sumber - left align
          cell.alignment = { horizontal: "left", vertical: "top" };
          break;
        case 5: // Tanggal - format as date
          if (date) {
            cell.numFmt = "DD MMM YYYY";
          } else {
            cell.value = "-";
          }
          cell.alignment = { horizontal: "center", vertical: "top" };
          break;
        case 6: // Positif
        case 7: // Netral
        case 8: // Negatif - center align checkmarks
          cell.alignment = { horizontal: "center", vertical: "top" };
          if (cell.value === "✓") {
            if (colNumber === 6) {
              cell.font = { color: { argb: "FF16A34A" } }; // Green for positive
            } else if (colNumber === 7) {
              cell.font = { color: { argb: "FF6B7280" } }; // Gray for neutral
            } else {
              cell.font = { color: { argb: "FFDC2626" } }; // Red for negative
            }
          }
          break;
        case 9: // URL - add hyperlink
          if (article.link) {
            cell.value = {
              text: article.link,
              hyperlink: article.link,
            };
            cell.font = HYPERLINK_FONT;
          }
          cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
          break;
        case 10: // Ringkasan - wrap text
          cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
          break;
        default:
          cell.alignment = { horizontal: "left", vertical: "top" };
      }
    });
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
