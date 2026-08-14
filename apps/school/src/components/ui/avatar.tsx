import { cn } from "@/lib/cn";

/**
 * A student's photograph, or their initial when there isn't one.
 *
 * Photos are served through `/api/photos/…`, which re-checks the session and
 * this reader's access to this particular child on every request. That is why
 * they are plain `<img>` rather than `next/image`: the optimiser would cache a
 * derivative outside that check.
 */
export function Avatar({
  photoKey,
  name,
  size = "md",
  className,
}: {
  photoKey?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "h-9 w-9 text-sm",
    md: "h-11 w-11 text-base",
    lg: "h-24 w-24 text-3xl",
  } as const;

  const base = cn(
    "shrink-0 overflow-hidden rounded-full bg-brand-100 object-cover",
    sizes[size],
    className,
  );

  if (photoKey) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/photos/${photoKey}`}
        alt=""
        className={base}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <span
      className={cn(base, "grid place-items-center font-semibold text-brand-800")}
      aria-hidden="true"
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
