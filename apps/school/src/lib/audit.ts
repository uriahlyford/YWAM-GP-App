import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { AuditAction } from "@/generated/prisma/enums";
import type { AuthContext } from "@/lib/auth/context";

/**
 * The audit spine.
 *
 * Built before any CRUD, deliberately. A school has to be able to answer "who
 * changed Dara's attendance from Present to Absent, and when" years after the
 * fact, and an audit trail added afterwards is always full of holes.
 *
 * `auditedWrite` runs the mutation and its log entry in one transaction, so the
 * two cannot diverge: if the log fails, the change rolls back with it. That is
 * the guarantee — not a convention that a future mutation might forget.
 */

/** Values that must never reach the log, whatever a caller passes. */
const REDACTED_KEYS = new Set([
  "passwordHash",
  "password",
  "newPassword",
  "confirmPassword",
  "hashedToken",
  "token",
]);

type Plain = Record<string, unknown>;

function redact(value: Plain): Plain {
  const out: Plain = {};
  for (const [key, v] of Object.entries(value)) {
    if (REDACTED_KEYS.has(key)) {
      out[key] = "[redacted]";
    } else if (v instanceof Date) {
      out[key] = v.toISOString();
    } else if (typeof v === "bigint") {
      out[key] = v.toString();
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[key] = redact(v as Plain);
    } else {
      out[key] = v ?? null;
    }
  }
  return out;
}

/**
 * Keep only the fields that actually changed. A log entry saying "twenty-eight
 * fields were written, all identical" is noise that hides the one that matters.
 */
export function diffOf(
  before: Plain | null | undefined,
  after: Plain | null | undefined,
): { before: Plain; after: Plain } | null {
  if (!before || !after) {
    return {
      before: before ? redact(before) : {},
      after: after ? redact(after) : {},
    };
  }

  const b = redact(before);
  const a = redact(after);
  const changedBefore: Plain = {};
  const changedAfter: Plain = {};

  for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (JSON.stringify(b[key]) !== JSON.stringify(a[key])) {
      changedBefore[key] = b[key] ?? null;
      changedAfter[key] = a[key] ?? null;
    }
  }

  if (Object.keys(changedAfter).length === 0) return null;
  return { before: changedBefore, after: changedAfter };
}

export type RequestMeta = { ip: string | null; userAgent: string | null };

export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    ip: forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
    userAgent: h.get("user-agent")?.slice(0, 500) ?? null,
  };
}

export type AuditEntry = {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  /** A human-readable subject — a student's name — kept so the entry still reads
   *  correctly after the row it points at has changed or been archived. */
  summary?: string | null;
  before?: Plain | null;
  after?: Plain | null;
  schoolId?: string | null;
  actorUserId?: string | null;
};

type Writer = Prisma.TransactionClient | typeof prisma;

async function write(db: Writer, entry: AuditEntry, meta: RequestMeta) {
  const changes = diffOf(entry.before, entry.after);

  await db.auditLog.create({
    data: {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary ?? null,
      before: (changes?.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (changes?.after ?? undefined) as Prisma.InputJsonValue | undefined,
      schoolId: entry.schoolId ?? null,
      actorUserId: entry.actorUserId ?? null,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });
}

/**
 * Log something that isn't a row change — a sign-in, a failed sign-in, an
 * export. There is no transaction to join, so this writes on its own.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  await write(prisma, entry, await requestMeta());
}

/**
 * Run a mutation and its audit entry as one transaction.
 *
 * The callback receives the transaction client and returns the entity it wrote
 * plus whatever the log should say about it. Nothing else in the application
 * should write to a student, attendance or grade table outside this.
 */
export async function auditedWrite<T extends { id: string }>(
  context: {
    auth: Pick<AuthContext, "user" | "schoolId"> | null;
    action: AuditAction;
    entityType: string;
    /** State before the change, for an update. Omit for a create. */
    before?: Plain | null;
    summary?: string | null;
    /** Override when the row belongs to a different campus than the caller's. */
    schoolId?: string | null;
  },
  run: (tx: Prisma.TransactionClient) => Promise<{ entity: T; after?: Plain | null }>,
): Promise<T> {
  const meta = await requestMeta();

  return prisma.$transaction(async (tx) => {
    const { entity, after } = await run(tx);

    await write(
      tx,
      {
        action: context.action,
        entityType: context.entityType,
        entityId: entity.id,
        summary: context.summary,
        before: context.before,
        after: after ?? (entity as unknown as Plain),
        schoolId: context.schoolId ?? context.auth?.schoolId ?? null,
        actorUserId: context.auth?.user.id ?? null,
      },
      meta,
    );

    return entity;
  });
}

export { AuditAction };
