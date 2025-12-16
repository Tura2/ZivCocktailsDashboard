import type { InputHTMLAttributes, ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  error?: string;
  helperText?: ReactNode;
  containerClassName?: string;
};

export function Input({
  label,
  error,
  helperText,
  containerClassName = "",
  className = "",
  id,
  ...rest
}: InputProps) {
  const inputId = id ?? rest.name ?? undefined;
  const describedBy = error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined;
  const base = "w-full rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white px-4 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 h-11";
  const composed = [base, className].filter(Boolean).join(" ");

  return (
    <label className={`flex flex-col gap-2 text-sm font-medium text-[var(--color-text-secondary)] ${containerClassName}`.trim()} htmlFor={inputId}>
      {label}
      <input id={inputId} className={composed} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...rest} />
      {error ? (
        <span id={describedBy} className="text-xs font-normal text-[var(--color-danger)]">
          {error}
        </span>
      ) : helperText ? (
        <span id={describedBy} className="text-xs font-normal text-[var(--color-text-tertiary)]">
          {helperText}
        </span>
      ) : null}
    </label>
  );
}
