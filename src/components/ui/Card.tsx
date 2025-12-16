import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
};

const paddingMap = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({
  className = "",
  elevated = false,
  padding = "md",
  children,
  ...rest
}: CardProps) {
  const base = "rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white";
  const shadow = elevated ? "shadow-[var(--shadow-card)]" : "shadow-[var(--shadow-card-soft)]";
  const composed = [base, shadow, paddingMap[padding], className].filter(Boolean).join(" ");

  return (
    <div className={composed} {...rest}>
      {children}
    </div>
  );
}
