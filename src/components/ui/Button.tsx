import type { ButtonHTMLAttributes, ReactNode } from "react";

const variantClasses = {
  primary:
    "bg-[var(--color-brand-primary)] text-white shadow-[var(--shadow-soft)] hover:bg-[var(--color-brand-primary-hover)]",
  secondary:
    "bg-[var(--color-bg-card)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)]",
  ghost: "bg-transparent text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-soft)]",
} as const;

const sizeClasses = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-base",
} as const;

type ButtonVariant = keyof typeof variantClasses;
type ButtonSize = keyof typeof sizeClasses;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  leadingIcon,
  trailingIcon,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-[var(--radius-lg)] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-page)] focus-visible:ring-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-70";
  const composed = [base, variantClasses[variant], sizeClasses[size], className]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={composed} disabled={disabled || isLoading} {...rest}>
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
            aria-hidden
          />
          <span>Working...</span>
        </span>
      ) : (
        <>
          {leadingIcon ? <span className="inline-flex h-4 w-4 items-center justify-center">{leadingIcon}</span> : null}
          {children}
          {trailingIcon ? <span className="inline-flex h-4 w-4 items-center justify-center">{trailingIcon}</span> : null}
        </>
      )}
    </button>
  );
}
