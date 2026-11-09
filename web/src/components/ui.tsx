// Small shadcn-style primitives using the same class recipes as AI Studio.
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const BUTTON_VARIANTS = {
  default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
  outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
  ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
  brand: "bg-amber-500 text-neutral-950 shadow-xs hover:bg-amber-400",
} as const;
const BUTTON_SIZES = { default: "h-9 px-4 py-2", sm: "h-8 gap-1.5 px-3", lg: "h-10 px-6", icon: "size-9" } as const;

export function buttonClass(variant: keyof typeof BUTTON_VARIANTS = "default", size: keyof typeof BUTTON_SIZES = "default", extra?: string) {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], extra);
}

export function Button({
  variant = "default",
  size = "default",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANTS; size?: keyof typeof BUTTON_SIZES }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bg-card text-card-foreground rounded-xl border shadow-sm", className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm",
        "placeholder:text-muted-foreground dark:bg-input/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none md:text-sm",
        "placeholder:text-muted-foreground dark:bg-input/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}

// Pill recipes lifted from AI Studio's status badges.
const PILL = {
  amber: "bg-amber-50 text-amber-700 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-500/20",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-500/20",
  neutral: "bg-neutral-100 text-neutral-600 ring-neutral-200/60 dark:bg-neutral-800 dark:text-neutral-400 dark:ring-neutral-700/50",
  red: "bg-red-50 text-red-700 ring-red-200/60 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-500/20",
  orange: "bg-orange-50 text-orange-700 ring-orange-200/60 dark:bg-orange-950/40 dark:text-orange-400 dark:ring-orange-500/20",
  sky: "bg-sky-50 text-sky-700 ring-sky-200/60 dark:bg-sky-950/40 dark:text-sky-400 dark:ring-sky-500/20",
} as const;
export type PillColor = keyof typeof PILL;

export function Pill({ color = "neutral", children, className }: { color?: PillColor; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 whitespace-nowrap [&_svg]:size-3", PILL[color], className)}>
      {children}
    </span>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider", className)}>{children}</h3>;
}

export function statusColor(status: string): PillColor {
  const s = status.toLowerCase();
  if (s === "completed" || s === "succeeded") return "emerald";
  if (s === "failed" || s === "error") return "red";
  if (s === "canceled" || s === "cancelled") return "neutral";
  return "sky";
}
