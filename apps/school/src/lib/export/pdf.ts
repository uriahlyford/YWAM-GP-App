import "server-only";
import path from "node:path";
import { readFileSync } from "node:fs";
import PDFDocument from "pdfkit";
import { create as createFont, type Font } from "fontkit";
import { cellToString, type ReportTable } from "./table";

/**
 * A4 PDF reports, with correctly shaped Khmer.
 *
 * This is the part worth explaining. Khmer is a complex script: the glyphs are
 * not a codepoint-to-glyph mapping. A subscript consonant (coeng, U+17D2 plus a
 * consonant) becomes a single stacked glyph beneath its base, and the subscript
 * ro reorders to the *front* of its cluster. Getting that wrong produces a PDF
 * whose text extracts perfectly and is unreadable to a Khmer speaker.
 *
 * pdfkit lays text out through fontkit, which does apply the font's GSUB/GPOS
 * tables. Verified against the shaped output before this was built: ថ្នាក់ is six
 * codepoints and shapes to five glyphs with U+17D2+U+1793 combined into the
 * subscript form, and ស្រី moves its coeng-ro ahead of the base. So server-side
 * generation is sound here, and the school gets a file rather than a print
 * dialog.
 *
 * A line is split into runs by which face can draw them, and Helvetica — built
 * into every PDF reader — takes what the Khmer face cannot. Battambang covers
 * ASCII and Khmer and nothing else: the en-dash, em-dash, middle dot and ellipsis
 * that appear in report subtitles are all missing from it, as is every accented
 * Latin letter, which a Cambodian record can easily carry.
 */

const FONT_DIR = path.join(process.cwd(), "src/assets/fonts");

type Fonts = { regular: Buffer; bold: Buffer; probe: Font };

let fonts: Fonts | null = null;

/**
 * Battambang, not the Noto Sans Khmer the web interface uses.
 *
 * That is not a style preference. fontkit's GPOS processor dereferences a null
 * mark-attachment anchor on `ម` + `៉` (U+1798 U+17C9) in every Noto Khmer build
 * tried — Sans, Serif and Medium — and throws mid-render, so a report containing
 * a name like ម៉ាលិស produced a 500 rather than a PDF. Browsers shape those fonts
 * fine, so the web side keeps Noto; only this path needs a font whose tables
 * fontkit can walk. Battambang shapes the same clusters correctly: coeng stacks,
 * and coeng-ro reorders to the front of its cluster.
 *
 * If this is ever unified with the web font, that crash comes back.
 */
function loadFonts(): Fonts {
  if (!fonts) {
    const regular = readFileSync(path.join(FONT_DIR, "Battambang-Regular.ttf"));
    const bold = readFileSync(path.join(FONT_DIR, "Battambang-Bold.ttf"));
    // The regular face answers the coverage question for both weights: they ship
    // the same 204-codepoint character set.
    fonts = { regular, bold, probe: createFont(regular) };
  }
  return fonts;
}

type Run = { text: string; khmer: boolean };

/**
 * Split a line into runs by which face can actually draw them.
 *
 * Asking the font rather than testing the Khmer Unicode block matters in both
 * directions: Battambang draws ASCII, so `S1023` and `86%` stay in the same face
 * as the Khmer around them, and it does *not* cover U+17DE–17FF or the Khmer
 * symbols block, which a block test would hand it to render as empty boxes.
 */
function splitRuns(text: string): Run[] {
  const { probe } = loadFonts();
  const runs: Run[] = [];
  for (const char of text) {
    const khmer = probe.hasGlyphForCodePoint(char.codePointAt(0)!);
    const last = runs[runs.length - 1];
    if (last && last.khmer === khmer) last.text += char;
    else runs.push({ text: char, khmer });
  }
  return runs;
}

type Doc = typeof PDFDocument extends new (...args: never[]) => infer T ? T : never;

const MARGIN = 40;
const PAGE_WIDTH = 595.28; // A4 at 72dpi
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/**
 * Where a line's baseline sits below the top of its line box, in ems.
 *
 * Every `y` in this file is the top of a line box; this constant turns it into a
 * baseline that is the same for every run on the line. Without it pdfkit derives
 * the baseline from whichever font is current, and the gap between Battambang's
 * ascender (1.22em) and Helvetica's (0.72em) sets a mixed line's Khmer run half a
 * line lower than the Latin run beside it.
 *
 * 1.0 is measured, not chosen: Battambang's ink reaches 0.98em above the baseline
 * for a cluster carrying a superscript sign, and 0.51em below it for a subscript
 * consonant — so a Khmer line needs 1.49em of room in total, which is what
 * ROW_HEIGHT allows at body size.
 */
const BASELINE = 1.0;

function fontFor(khmer: boolean, bold: boolean): string {
  if (khmer) return bold ? "khmer-bold" : "khmer";
  return bold ? "Helvetica-Bold" : "Helvetica";
}

/** Draw one line of mixed text at `y` (the top of its line box), switching font per run. */
function drawRuns(
  doc: Doc,
  text: string,
  x: number,
  y: number,
  options: { size: number; bold?: boolean; width: number; align?: "left" | "right" },
): void {
  const runs = splitRuns(text);
  if (runs.length === 0) return;

  doc.fontSize(options.size);

  const widths = runs.map((run) => {
    doc.font(fontFor(run.khmer, options.bold ?? false));
    return doc.widthOfString(run.text);
  });
  const total = widths.reduce((sum, width) => sum + width, 0);

  let cursor = options.align === "right" ? x + options.width - total : x;
  const baseline = y + options.size * BASELINE;

  runs.forEach((run, index) => {
    doc.font(fontFor(run.khmer, options.bold ?? false));
    // `lineBreak: false` keeps the run on this line; wrapping is handled by the
    // caller truncating, because a table cell that reflows breaks the grid.
    // `baseline: "alphabetic"` makes the y above the baseline itself rather than
    // an offset from the current font's ascender — see BASELINE.
    doc.text(run.text, cursor, baseline, { lineBreak: false, baseline: "alphabetic" });
    cursor += widths[index];
  });
}

/** Truncate to fit a column, measuring with the fonts that will actually draw it. */
function fit(doc: Doc, text: string, size: number, width: number, bold = false): string {
  doc.fontSize(size);
  const measure = (value: string) =>
    splitRuns(value).reduce((sum, run) => {
      doc.font(fontFor(run.khmer, bold));
      return sum + doc.widthOfString(run.text);
    }, 0);

  if (measure(text) <= width) return text;

  let result = text;
  while (result.length > 1 && measure(`${result}…`) > width) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

export async function toPdf(table: ReportTable): Promise<Buffer> {
  const { regular, bold } = loadFonts();

  const doc = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    info: { Title: table.title, Creator: "Sala" },
    // pdfkit's default font is Helvetica; registering ours before any text is
    // drawn keeps the first Khmer run from falling back.
    autoFirstPage: false,
  });

  doc.registerFont("khmer", regular);
  doc.registerFont("khmer-bold", bold);
  doc.addPage();

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  // Column widths: use the caller's hints where given, share the rest. Hints are
  // authored per report against this page width, but they are still hints — if
  // they add up to more than the page holds, squeeze them all rather than let the
  // last columns run off the right margin.
  const hinted = table.columns.reduce((sum, column) => sum + (column.width ?? 0), 0);
  const squeeze = hinted > CONTENT_WIDTH ? CONTENT_WIDTH / hinted : 1;
  const unhinted = table.columns.filter((column) => !column.width).length;
  const spare = Math.max(0, CONTENT_WIDTH - hinted * squeeze);
  const widths = table.columns.map((column) =>
    column.width ? column.width * squeeze : unhinted > 0 ? spare / unhinted : 0,
  );
  const xs = widths.reduce<number[]>((acc, width, index) => {
    acc.push(index === 0 ? MARGIN : acc[index - 1] + widths[index - 1]);
    return acc;
  }, []);

  let y = MARGIN;

  function header() {
    drawRuns(doc, table.title, MARGIN, y, { size: 15, bold: true, width: CONTENT_WIDTH });
    y += 24;
    if (table.subtitle) {
      doc.fillColor("#5c5751");
      drawRuns(doc, table.subtitle, MARGIN, y, { size: 9.5, width: CONTENT_WIDTH });
      doc.fillColor("#1a1816");
      y += 20;
    }
    y += 2;

    doc.fillColor("#433f3a");
    table.columns.forEach((column, index) => {
      drawRuns(doc, fit(doc, column.label, 9, widths[index] - 6, true), xs[index] + 2, y, {
        size: 9,
        bold: true,
        width: widths[index] - 4,
        align: column.align === "end" ? "right" : "left",
      });
    });
    doc.fillColor("#1a1816");
    y += 16;

    doc
      .moveTo(MARGIN, y)
      .lineTo(PAGE_WIDTH - MARGIN, y)
      .lineWidth(0.75)
      .strokeColor("#d3cfc5")
      .stroke();
    y += 6;
  }

  header();

  // A Khmer line needs 1.49em of ink height (see BASELINE); 16pt at 9.5pt text
  // clears that with a little air between rows.
  const rowHeight = 16;
  const bottom = PAGE_HEIGHT - MARGIN - 24;

  for (const row of table.rows) {
    if (y + rowHeight > bottom) {
      doc.addPage();
      y = MARGIN;
      header();
    }

    row.forEach((cell, index) => {
      const column = table.columns[index];
      if (!column) return;
      drawRuns(
        doc,
        fit(doc, cellToString(cell), 9.5, widths[index] - 6),
        xs[index] + 2,
        y,
        {
          size: 9.5,
          width: widths[index] - 4,
          align: column.align === "end" ? "right" : "left",
        },
      );
    });

    y += rowHeight;
  }

  if (table.total) {
    doc
      .moveTo(MARGIN, y)
      .lineTo(PAGE_WIDTH - MARGIN, y)
      .lineWidth(0.75)
      .strokeColor("#d3cfc5")
      .stroke();
    y += 6;

    table.total.forEach((cell, index) => {
      const column = table.columns[index];
      if (!column) return;
      drawRuns(
        doc,
        fit(doc, cellToString(cell), 9.5, widths[index] - 6, true),
        xs[index] + 2,
        y,
        {
          size: 9.5,
          bold: true,
          width: widths[index] - 4,
          align: column.align === "end" ? "right" : "left",
        },
      );
    });
    y += rowHeight;
  }

  if (table.notes?.length) {
    y += 8;
    doc.fillColor("#5c5751");
    for (const note of table.notes) {
      if (y + 14 > bottom) {
        doc.addPage();
        y = MARGIN;
      }
      drawRuns(doc, fit(doc, note, 8.5, CONTENT_WIDTH), MARGIN, y, {
        size: 8.5,
        width: CONTENT_WIDTH,
      });
      y += 14;
    }
  }

  doc.end();
  await done;
  return Buffer.concat(chunks);
}
