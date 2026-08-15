import "server-only";
import { cellToString, type ReportTable } from "./table";

/**
 * RFC 4180 CSV, with two Cambodia-specific details.
 *
 * A UTF-8 byte-order mark, because Excel on Windows otherwise reads a UTF-8 file
 * as the system codepage and turns every Khmer name into mojibake — the single
 * most common way an exported school report arrives unreadable.
 *
 * CRLF line endings, for the same reader.
 */
const BOM = "﻿";

function escape(value: string): string {
  // A leading =, +, - or @ is executed as a formula by Excel and Sheets. A
  // student's name will not start with one, but a note field could, and a CSV
  // that can run code when opened is not something to ship into a school office.
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

  if (/[",\r\n]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

function line(cells: string[]): string {
  return cells.map(escape).join(",");
}

export function toCsv(table: ReportTable): string {
  const rows: string[] = [];

  rows.push(line([table.title]));
  if (table.subtitle) rows.push(line([table.subtitle]));
  rows.push("");

  rows.push(line(table.columns.map((column) => column.label)));

  for (const row of table.rows) {
    rows.push(line(row.map(cellToString)));
  }

  if (table.total) {
    rows.push(line(table.total.map(cellToString)));
  }

  if (table.notes?.length) {
    rows.push("");
    for (const note of table.notes) rows.push(line([note]));
  }

  return BOM + rows.join("\r\n") + "\r\n";
}
