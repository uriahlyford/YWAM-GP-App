import "server-only";
import ExcelJS from "exceljs";
import type { ReportTable } from "./table";

/**
 * A real .xlsx, not a CSV with the wrong extension.
 *
 * Khmer needs a font that has the glyphs — Calibri does not, so cells would open
 * as boxes on a machine that falls back to it. Naming Noto Sans Khmer in the cell
 * style makes Excel and LibreOffice pick it up where installed, and both fall
 * back to something with Khmer coverage rather than to Calibri.
 */
const FONT = { name: "Noto Sans Khmer", size: 11 };

export async function toXlsx(table: ReportTable): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sala";
  workbook.created = new Date();

  // Sheet names cannot exceed 31 characters or contain : \ / ? * [ ]
  const sheetName = table.title.replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Report";
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: table.subtitle ? 4 : 3 }],
  });

  const titleRow = sheet.addRow([table.title]);
  titleRow.font = { ...FONT, size: 14, bold: true };
  sheet.mergeCells(titleRow.number, 1, titleRow.number, Math.max(1, table.columns.length));

  if (table.subtitle) {
    const subtitleRow = sheet.addRow([table.subtitle]);
    subtitleRow.font = { ...FONT, color: { argb: "FF666666" } };
    sheet.mergeCells(
      subtitleRow.number,
      1,
      subtitleRow.number,
      Math.max(1, table.columns.length),
    );
  }

  sheet.addRow([]);

  const header = sheet.addRow(table.columns.map((column) => column.label));
  header.font = { ...FONT, bold: true };
  header.eachCell((cell, index) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF4F2EE" },
    };
    cell.alignment = {
      horizontal: table.columns[index - 1]?.align === "end" ? "right" : "left",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = { bottom: { style: "thin", color: { argb: "FFD3CFC5" } } };
  });

  for (const row of table.rows) {
    const added = sheet.addRow(row.map((cell) => cell ?? ""));
    added.font = FONT;
    added.eachCell((cell, index) => {
      cell.alignment = {
        horizontal: table.columns[index - 1]?.align === "end" ? "right" : "left",
        vertical: "middle",
      };
    });
  }

  if (table.total) {
    const totalRow = sheet.addRow(table.total.map((cell) => cell ?? ""));
    totalRow.font = { ...FONT, bold: true };
    totalRow.eachCell((cell) => {
      cell.border = { top: { style: "thin", color: { argb: "FFD3CFC5" } } };
    });
  }

  if (table.notes?.length) {
    sheet.addRow([]);
    for (const note of table.notes) {
      const noteRow = sheet.addRow([note]);
      noteRow.font = { ...FONT, size: 10, color: { argb: "FF666666" } };
    }
  }

  table.columns.forEach((column, index) => {
    const values = table.rows.map((row) => String(row[index] ?? ""));
    const longest = Math.max(
      column.label.length,
      ...values.map((value) => value.length),
      6,
    );
    // Khmer glyphs are wider than Latin at the same character count, so pad more
    // when the column actually contains Khmer.
    const hasKhmer = values.some((value) => /[ក-៿]/.test(value));
    sheet.getColumn(index + 1).width = Math.min(
      52,
      Math.round(longest * (hasKhmer ? 1.6 : 1.15)) + 2,
    );
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
