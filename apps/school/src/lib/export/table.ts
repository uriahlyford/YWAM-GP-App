import "server-only";

/**
 * The one shape every report produces, and the three exporters consume.
 *
 * Reports build this once; CSV, Excel and PDF are then three renderings of the
 * same thing rather than three near-copies of the same query that drift apart.
 */
export type Cell = string | number | null;

export type ReportTable = {
  /** Used as the filename stem and the PDF/sheet title. */
  title: string;
  subtitle?: string;
  columns: { key: string; label: string; align?: "start" | "end"; width?: number }[];
  rows: Cell[][];
  /** Optional summary row rendered distinctly in every format. */
  total?: Cell[];
  /** Free-text notes printed under the table. */
  notes?: string[];
};

export function cellToString(value: Cell): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * A filename that survives a trip through Windows, macOS and a Cambodian
 * teacher's phone: ASCII only, no separators, no leading dot. Khmer titles are
 * transliterated away rather than percent-encoded, because a downloaded file
 * called `%E1%9E%9F...xlsx` is not something anyone can find again.
 */
export function safeFilename(stem: string, extension: string): string {
  const ascii = stem
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${ascii || "report"}.${extension}`;
}
