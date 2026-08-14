"use client";

import { useEffect } from "react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/surface";

/**
 * `ForbiddenError` from the access helpers arrives here. React strips the
 * message in production builds, so the boundary distinguishes the two cases by
 * the digest Next.js attaches, and otherwise says as little as possible — an
 * error page is not a place to leak which record exists.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  const forbidden = error.name === "ForbiddenError";

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="p-6">
      <div className="mx-auto max-w-md space-y-4 pt-8 text-center">
        <h1 className="text-xl font-semibold text-ink-900">
          {forbidden ? t("error.forbidden") : t("error.title")}
        </h1>
        <p className="text-ink-600">
          {forbidden ? t("error.forbidden.body") : t("error.generic")}
        </p>
        {error.digest ? (
          <Alert tone="info" className="text-left font-mono text-xs">
            {error.digest}
          </Alert>
        ) : null}
        {!forbidden ? (
          <Button onClick={reset} variant="secondary">
            {t("action.retry")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
