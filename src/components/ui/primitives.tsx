"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { LoaderIcon } from "./icons";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-black hover:bg-white",
  secondary: "bg-raised text-ink hover:bg-[#262626]",
  ghost: "bg-transparent text-ink-muted hover:text-ink",
  danger: "bg-[#3a1414] text-danger hover:bg-[#4a1a1a]",
};

const SIZES: Record<Size, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5 font-medium",
  sm: "h-8 px-3 text-xs gap-2 font-medium",
  md: "h-[38px] px-3.5 text-sm gap-2 font-medium",
  lg: "h-[46px] px-5 text-[15px] gap-2.5 font-semibold",
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
        "inline-flex cursor-pointer select-none items-center justify-center rounded-control",
        "transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-40",
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
// IconButton — circular icon-only control (queue cancel, sidebar links, ×)
// ---------------------------------------------------------------------
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 28 | 32 | 40;
  bordered?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 32, bordered, className, children, ...rest },
  ref
) {
  const px = size === 28 ? "h-7 w-7" : size === 40 ? "h-10 w-10" : "h-8 w-8";
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full",
        "text-ink-muted transition-colors duration-150 hover:text-ink",
        "disabled:cursor-not-allowed disabled:opacity-40",
        px,
        bordered ? "border border-[#2b2b2b] bg-surface" : "bg-transparent",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

// ---------------------------------------------------------------------
// Section header used inside option panels — plain label + faint hint.
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
    <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
      <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
        {icon}
        {title}
      </span>
      {hint && <span className="text-xs text-ink-faint">{hint}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------
// Selectable list row (radio behaviour) — inverted fill when selected.
// ---------------------------------------------------------------------
export function OptionRow({
  selected,
  onSelect,
  disabled,
  className,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  className?: string;
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
        "flex w-full cursor-pointer rounded-control px-3.5 text-left text-[13px]",
        "transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-40",
        selected ? "bg-ink text-black" : "bg-transparent text-ink hover:bg-[#1a1a1a]",
        className ?? "min-h-11 items-center"
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------
// Switch — 36×20 track, matches the mockup's on/off states exactly.
// ---------------------------------------------------------------------
export function Switch({
  checked,
  onChange,
  label,
  description,
  flag,
  id,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  /** Faint monospace flag shown inline instead of a description (e.g. --embed-subs). */
  flag?: string;
  id: string;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 py-2.5",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      <span className="flex-1">
        <span className="block text-[13px] text-ink">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[11.5px] text-ink-faint">{description}</span>
        )}
      </span>
      {flag && <span className="text-xs text-ink-faint">{flag}</span>}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150",
          checked ? "bg-ink" : "bg-[#2b2b2b]"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full transition-[left] duration-150",
            checked ? "left-[18px] bg-black" : "left-0.5 bg-ink-faint"
          )}
        />
      </button>
    </label>
  );
}

// ---------------------------------------------------------------------
// Segmented control — pill (mode selector) or grid (e.g. 1–6 concurrency).
// ---------------------------------------------------------------------
export function Segmented<T extends string | number>({
  items,
  value,
  onChange,
  ariaLabel,
  layout = "inline",
  className,
}: {
  items: { value: T; label: ReactNode; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  layout?: "inline" | "grid";
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex overflow-hidden rounded-control bg-surface-2",
        layout === "grid" && "grid",
        className
      )}
      style={layout === "grid" ? { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` } : undefined}
    >
      {items.map((it, i) => {
        const on = it.value === value;
        return (
          <button
            key={String(it.value)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(it.value)}
            className={cn(
              "flex h-[38px] cursor-pointer items-center justify-center gap-2 px-3.5 text-sm font-medium transition-colors duration-150",
              i < items.length - 1 && "border-r border-black",
              on ? "bg-ink text-black" : "bg-transparent text-ink hover:bg-[#1a1a1a]"
            )}
          >
            {it.icon}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// Chip — small tag used for type/format/count labels.
// ---------------------------------------------------------------------
export function Chip({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "inverted" | "video" | "audio" | "subs" | "done" | "danger" | "warn";
  children: ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-raised text-ink-muted",
    inverted: "bg-ink text-black",
    video: "bg-video-tint text-video",
    audio: "bg-audio-tint text-audio",
    subs: "bg-subs-tint text-subs",
    done: "bg-[#123322] text-done",
    danger: "bg-danger-bg text-danger-text",
    warn: "bg-warn-bg text-warn border border-warn-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

// Legacy alias kept for call sites migrated incrementally.
export const Badge = Chip;

// ---------------------------------------------------------------------
// Card — rounded-card surface container.
// ---------------------------------------------------------------------
export function Card({
  children,
  className,
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <section aria-label={ariaLabel} className={cn("rounded-card bg-surface", className)}>
      {children}
    </section>
  );
}
