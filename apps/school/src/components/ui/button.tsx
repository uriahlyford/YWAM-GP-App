import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Sizes start at 44px because this is used one-handed on a phone. `lg` is for
 * the attendance screen, where a teacher is tapping through thirty children.
 */
const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
  {
    variants: {
      variant: {
        primary: "bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900",
        secondary:
          "bg-white text-ink-800 border border-ink-300 hover:bg-ink-100 active:bg-ink-200",
        ghost: "text-ink-700 hover:bg-ink-100 active:bg-ink-200",
        danger: "bg-absent-700 text-white hover:bg-absent-500",
      },
      size: {
        sm: "h-10 px-3 text-sm",
        md: "h-11 px-4 text-[0.9375rem]",
        lg: "h-13 px-5 text-base",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button>;

export function Button({
  className,
  variant,
  size,
  block,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(button({ variant, size, block }), className)}
      {...props}
    />
  );
}

export { button as buttonStyles };
