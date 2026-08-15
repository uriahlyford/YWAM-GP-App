import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/context";
import { AuditAction, recordAudit } from "@/lib/audit";
import { isDateOnly, type DateOnly } from "@/lib/date";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { buildReport } from "@/features/reports/queries";
import { isReportKind, REPORT_PARAMS } from "@/features/reports/kinds";
import { toCsv } from "@/lib/export/csv";
import { toXlsx } from "@/lib/export/xlsx";
import { toPdf } from "@/lib/export/pdf";
import { safeFilename } from "@/lib/export/table";

/**
 * Report downloads.
 *
 * Every export is audited. A file leaving the building with a hundred children's
 * names on it is exactly the event a school needs a record of, and it is the one
 * kind of read that deserves the same treatment as a write.
 *
 * The report is built through the same `buildReport` the screen uses, so a
 * downloaded figure can never disagree with the figure the reader saw.
 */
const FORMATS = {
  csv: {
    extension: "csv",
    // `charset=utf-8` plus the BOM the writer emits: Excel on Windows needs both.
    contentType: "text/csv; charset=utf-8",
  },
  xlsx: {
    extension: "xlsx",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  pdf: { extension: "pdf", contentType: "application/pdf" },
} as const;

type Format = keyof typeof FORMATS;

function isFormat(value: string | null): value is Format {
  return value !== null && value in FORMATS;
}

function dateParam(value: string | null): DateOnly | undefined {
  return value && isDateOnly(value) ? value : undefined;
}

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/reports/[kind]">,
) {
  const auth = await requirePermission("reports.read");

  const { kind } = await params;
  if (!isReportKind(kind)) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  if (!isFormat(format)) return new Response("Unsupported format", { status: 400 });

  const localeParam = url.searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE;

  const monthParam = url.searchParams.get("month");

  let table;
  try {
    table = await buildReport(auth, {
      kind,
      locale,
      date: dateParam(url.searchParams.get("date")),
      from: dateParam(url.searchParams.get("from")),
      to: dateParam(url.searchParams.get("to")),
      month: monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : undefined,
      classId: url.searchParams.get("class") ?? undefined,
      studentId: url.searchParams.get("student") ?? undefined,
      termId: url.searchParams.get("term") ?? undefined,
    });
  } catch {
    // A missing or malformed parameter, not a server fault.
    return new Response("Bad request", { status: 400 });
  }

  const school = await prisma.school.findUniqueOrThrow({
    where: { id: auth.schoolId },
    select: { code: true },
  });

  // Named from the parameters, not from the report's own subtitle: that subtitle
  // is localised, and stripping Khmer out of it leaves a filename like
  // "monthly-attendance-1-2026-31-2026".
  //
  // Which parameter names the file depends on the report, because the screen
  // sends all of them on every download — dating a single day's register by the
  // month box the reader never touched is how a filing cabinet loses a file.
  const takes = REPORT_PARAMS[kind] as readonly string[];
  const range = [url.searchParams.get("from"), url.searchParams.get("to")]
    .filter(Boolean)
    .join("_");
  const stamp =
    (takes.includes("month") ? url.searchParams.get("month") : null) ??
    (takes.includes("from") ? range : null) ??
    (takes.includes("date") ? url.searchParams.get("date") : null) ??
    "";

  const filename = safeFilename(
    [school.code, kind, stamp].filter(Boolean).join("-"),
    FORMATS[format].extension,
  );

  await recordAudit({
    action: AuditAction.EXPORT,
    entityType: "Report",
    schoolId: auth.schoolId,
    actorUserId: auth.user.id,
    summary: `${kind} · ${format} · ${table.rows.length} rows`,
    after: { kind, format, rows: table.rows.length, query: url.search },
  });

  const body =
    format === "csv"
      ? Buffer.from(toCsv(table), "utf8")
      : format === "xlsx"
        ? await toXlsx(table)
        : await toPdf(table);

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": FORMATS[format].contentType,
      "Content-Length": String(body.byteLength),
      // The filename is ASCII by construction, so no RFC 5987 encoding needed.
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
