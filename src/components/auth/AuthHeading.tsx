'use client';

import type { ReactNode } from "react";

type AuthHeadingProps = {
  eyebrow?: ReactNode;
  title: string;
  subtitle?: string;
};

export function AuthHeading({ eyebrow, title, subtitle }: AuthHeadingProps) {
  return (
    <div className="space-y-3">
      {eyebrow ? (
        <div className="inline-flex items-center gap-2 rounded-full bg-[#e3efdc] px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#3a5b22]">
          {eyebrow}
        </div>
      ) : null}
      <div>
        <h1 className="text-[32px] font-medium text-[var(--auth-text-strong)]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 text-sm text-[var(--auth-text-muted)]">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
