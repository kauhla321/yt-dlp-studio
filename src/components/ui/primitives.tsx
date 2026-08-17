"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { LoaderIcon } from "./icons";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-salmon text-canvas hover:bg-salmon-hover disabled:bg-salmon/40 shadow-glow-salmon",
  secondary:
    "bg-panel2 text-ink hover:bg-panel2/70 border border-border hover:border-accent/50 hover:text-accent",
  ghost: "bg-transparent text-ink-muted hover:text-salmon hover:bg-panel2/60",
  danger: "bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, children, className, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium",
        "transition-[transform,background-color,box-shadow,color] duration-200 ease-spring",
        "cursor-pointer select-none hover:-translate-y-0.5 active:translate-y-0 active:scale-95",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-y-0 disabled:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading ? <LoaderIcon className="h-4 w-4" /> : icon}
      {children}
    </button>
  );
});

// ---------------------------------------------------------------------
// Section header used inside option panels
// ---------------------------------------------------------------------
export function SectionTitle({
  icon,
  title,
  hint,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      {icon && <span className="text-accent">{icon}</span>}
      <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">{title}</h3>
      {hint && <span className="text-xs text-ink-faint">{hint}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------
// Selectable option row (radio behaviour)
// ---------------------------------------------------------------------
export function OptionRow({
  selected,
  onSelect,
  disabled,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left",
        "card-hover cursor-pointer active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none",
        selected
          ? "border-accent/60 bg-accent-soft shadow-glow"
          : "border-border bg-canvas/50 hover:border-border/80 hover:bg-panel2/40"
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-accent" : "border-ink-faint"
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
      <span className="flex-1">{children}</span>
    </button>
  );
}

// ---------------------------------------------------------------------
// Toggle / checkbox
// ---------------------------------------------------------------------
export function Toggle({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  id: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-canvas/50 px-4 py-3 transition-colors hover:bg-panel2/40"
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200",
          checked ? "bg-salmon" : "bg-panel2"
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>
      <span className="flex-1">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-ink-muted">{description}</span>
        )}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warn" | "danger" | "info" | "salmon";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-panel2 text-ink-muted border-border",
    success: "bg-accent/15 text-accent border-accent/30",
    warn: "bg-warn/15 text-warn border-warn/30",
    danger: "bg-danger/15 text-danger border-danger/30",
    info: "bg-info/15 text-info border-info/30",
    salmon: "bg-salmon/15 text-salmon border-salmon/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}
