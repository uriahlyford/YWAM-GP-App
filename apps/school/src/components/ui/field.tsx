import { cn } from "@/lib/cn";

const controlBase =
  "w-full rounded-xl border border-ink-300 bg-white px-3.5 text-ink-900 " +
  "placeholder:text-ink-400 " +
  // 16px minimum: anything smaller makes iOS Safari zoom the page on focus.
  "text-base " +
  "focus:border-brand-600 focus:outline-2 focus:outline-offset-0 focus:outline-brand-600 " +
  "disabled:bg-ink-100 disabled:text-ink-500 " +
  "aria-[invalid=true]:border-absent-500";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlBase, "h-11", className)} {...props} />;
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(controlBase, "h-11 pr-8", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlBase, "py-2.5", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-ink-700"
      >
        {label}
        {/* Hidden from the accessibility tree: the control's own `required`
            already announces this, and leaving the asterisk in would make the
            field's accessible name "Password *". */}
        {required ? (
          <span className="ml-1 text-absent-700" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? <p className="text-sm text-ink-500">{hint}</p> : null}
      {error ? (
        <p className="text-sm text-absent-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
