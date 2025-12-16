'use client';

import { useId } from "react";

type TextFieldProps = {
  label: string;
  placeholder: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  error?: string;
};

export function TextField({
  label,
  placeholder,
  name,
  value,
  onChange,
  type = "text",
  autoComplete,
  error,
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = `${name}-${generatedId}`;
  const describedBy = error ? `${inputId}-error` : undefined;

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="text-[14px] font-medium text-[var(--auth-text-strong)]"
      >
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className="h-11 w-full rounded-[10px] border border-[var(--auth-stroke)] bg-white px-4 text-[13px] text-[var(--auth-text-strong)] placeholder:text-[#d9d9d9] focus:border-[#3a5b22] focus:outline-none focus:ring-2 focus:ring-[#3a5b22]/20"
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        required
      />
      {error ? (
        <p id={describedBy} className="text-[12px] text-[#d94841]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
