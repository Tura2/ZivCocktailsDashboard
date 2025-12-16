'use client';

type CheckboxWithLabelProps = {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  highlightText?: string;
  highlightHref?: string;
  error?: string;
};

export function CheckboxWithLabel({
  checked,
  onChange,
  label,
  highlightText,
  highlightHref,
  error,
}: CheckboxWithLabelProps) {
  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-start gap-3 text-[12px] text-[var(--auth-text-muted)]">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 appearance-none rounded-[6px] border border-[var(--auth-stroke)] bg-white transition-colors checked:border-[#3a5b22] checked:bg-[#3a5b22] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5b22]/40 focus-visible:ring-offset-2"
        />
        <span>
          {label}{" "}
          {highlightText ? (
            <a
              href={highlightHref}
              className="font-semibold text-[var(--auth-link)] underline-offset-2 hover:underline"
            >
              {highlightText}
            </a>
          ) : null}
        </span>
      </label>
      {error ? <p className="text-[12px] text-[#d94841]">{error}</p> : null}
    </div>
  );
}
