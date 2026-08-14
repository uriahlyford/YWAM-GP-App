"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Route } from "next";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import { AuditAction } from "@/generated/prisma/enums";
import { Select } from "@/components/ui/field";

/**
 * Filters live in the URL rather than component state, so a filtered view can
 * be sent to someone else — which is most of the point of an audit log.
 */
export function AuditFilters({
  action,
  entityType,
  entityTypes,
}: {
  action?: AuditAction;
  entityType?: string;
  entityTypes: string[];
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function apply(next: { action?: string; entity?: string }) {
    const params = new URLSearchParams();
    const nextAction = "action" in next ? next.action : action;
    const nextEntity = "entity" in next ? next.entity : entityType;
    if (nextAction) params.set("action", nextAction);
    if (nextEntity) params.set("entity", nextEntity);
    const qs = params.toString();
    startTransition(() => {
      router.replace(`${pathname}${qs ? `?${qs}` : ""}` as Route);
    });
  }

  return (
    <div className="flex flex-wrap gap-3" data-pending={pending || undefined}>
      <label className="min-w-40 flex-1 sm:max-w-56">
        <span className="mb-1.5 block text-sm font-medium text-ink-700">
          {t("audit.filter.action")}
        </span>
        <Select
          value={action ?? ""}
          onChange={(event) =>
            apply({ action: event.target.value || undefined })
          }
        >
          <option value="">{t("audit.filter.all")}</option>
          {Object.values(AuditAction).map((value) => (
            <option key={value} value={value}>
              {t(`audit.action.${value}` as MessageKey)}
            </option>
          ))}
        </Select>
      </label>

      <label className="min-w-40 flex-1 sm:max-w-56">
        <span className="mb-1.5 block text-sm font-medium text-ink-700">
          {t("audit.filter.entity")}
        </span>
        <Select
          value={entityType ?? ""}
          onChange={(event) =>
            apply({ entity: event.target.value || undefined })
          }
        >
          <option value="">{t("audit.filter.all")}</option>
          {entityTypes.map((value) => (
            <option key={value} value={value}>
              {t(`audit.entity.${value}` as MessageKey)}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}
