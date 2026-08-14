import Link from "next/link";
import type { Route } from "next";
import { requirePermission } from "@/lib/auth/context";
import {
  createTranslator,
  formatDate,
  formatNumber,
  isLocale,
  pickName,
  DEFAULT_LOCALE,
  type MessageKey,
  type Translator,
} from "@/lib/i18n";
import { dateOnlyOf, timeOfDay } from "@/lib/date";
import { AuditAction } from "@/generated/prisma/enums";
import {
  AUDIT_PAGE_SIZE,
  auditEntityTypes,
  listAuditEntries,
} from "@/features/audit/queries";
import { PageBody, PageHeader } from "@/components/ui/page";
import { Card, EmptyState } from "@/components/ui/surface";
import { AuditFilters } from "@/features/audit/filters";

type ChangeMap = Record<string, unknown>;

function asMap(value: unknown): ChangeMap | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ChangeMap)
    : null;
}

function display(t: Translator, value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return t("audit.blank");
  }
  if (typeof value === "boolean") return value ? t("common.yes") : t("common.no");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Renders only the fields that actually changed. The log entry stores just
 * those, so a row here is a short list of "field: old → new" rather than a wall
 * of unchanged columns.
 */
function Changes({ t, before, after }: { t: Translator; before: unknown; after: unknown }) {
  const b = asMap(before);
  const a = asMap(after);
  if (!a || Object.keys(a).length === 0) return null;

  return (
    <dl className="mt-2 space-y-1">
      {Object.keys(a).map((key) => (
        <div key={key} className="flex flex-wrap gap-x-2 text-sm">
          <dt className="font-medium text-ink-600">{key}</dt>
          <dd className="text-ink-500">
            {b && key in b ? (
              <>
                <span className="line-through">{display(t, b[key])}</span>
                <span aria-hidden="true"> → </span>
                <span className="sr-only"> {t("audit.to")} </span>
                <span className="text-ink-800">{display(t, a[key])}</span>
              </>
            ) : (
              <span className="text-ink-800">{display(t, a[key])}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AuditPage({
  params,
  searchParams,
}: PageProps<"/[locale]/audit">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const auth = await requirePermission("audit.read");

  const query = await searchParams;
  const actionParam = typeof query.action === "string" ? query.action : undefined;
  const entityParam = typeof query.entity === "string" ? query.entity : undefined;
  const page = Math.max(1, Number(query.page) || 1);

  const action =
    actionParam && actionParam in AuditAction
      ? (actionParam as AuditAction)
      : undefined;

  const [{ entries, total }, entityTypes] = await Promise.all([
    listAuditEntries(auth, { action, entityType: entityParam, page }),
    auditEntityTypes(auth),
  ]);

  const lastPage = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * AUDIT_PAGE_SIZE + 1;
  const to = Math.min(page * AUDIT_PAGE_SIZE, total);

  function pageHref(target: number): Route {
    const next = new URLSearchParams();
    if (action) next.set("action", action);
    if (entityParam) next.set("entity", entityParam);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return `/${locale}/audit${qs ? `?${qs}` : ""}` as Route;
  }

  return (
    <PageBody>
      <PageHeader title={t("audit.title")} description={t("audit.subtitle")} />

      <AuditFilters
        action={action}
        entityType={entityParam}
        entityTypes={entityTypes}
      />

      <Card className="mt-4 overflow-hidden">
        {entries.length === 0 ? (
          <EmptyState title={t("audit.empty")} />
        ) : (
          <ul className="divide-y divide-ink-200">
            {entries.map((entry) => {
              const when = entry.createdAt;
              // A null actor is either the system itself — a failed sign-in
              // against a username that doesn't exist belongs to nobody — or an
              // account since removed. The two aren't distinguishable once the
              // foreign key has been nulled, so both read as System.
              const actor = entry.actor
                ? pickName(locale, entry.actor.displayName, entry.actor.displayNameKm)
                : t("audit.system");

              return (
                <li key={entry.id} className="px-4 py-3.5 sm:px-5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-medium text-ink-900">{actor}</span>
                    <span className="text-ink-600">
                      {t(`audit.action.${entry.action}` as MessageKey)}
                    </span>
                    <span className="rounded-md bg-ink-100 px-1.5 py-0.5 text-xs font-medium text-ink-600">
                      {t(`audit.entity.${entry.entityType}` as MessageKey)}
                    </span>
                    {entry.summary ? (
                      <span className="text-ink-700">{entry.summary}</span>
                    ) : null}
                    <span className="ms-auto shrink-0 text-sm tabular-nums text-ink-400">
                      {formatDate(t, dateOnlyOf(when))} · {timeOfDay(when)}
                    </span>
                  </div>

                  <Changes t={t} before={entry.before} after={entry.after} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {total > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-500">
            {t("audit.showing", {
              from: formatNumber(locale, from),
              to: formatNumber(locale, to),
              total: formatNumber(locale, total),
            })}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="tap-target inline-flex items-center rounded-xl border border-ink-300 bg-white px-4 text-sm font-medium text-ink-700 hover:bg-ink-100"
              >
                {t("action.previous")}
              </Link>
            ) : null}
            {page < lastPage ? (
              <Link
                href={pageHref(page + 1)}
                className="tap-target inline-flex items-center rounded-xl border border-ink-300 bg-white px-4 text-sm font-medium text-ink-700 hover:bg-ink-100"
              >
                {t("action.next")}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </PageBody>
  );
}
