import type { HTMLAttributes, ReactNode } from "react";

type SectionHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  align?: "start" | "center" | "between";
};

const alignmentMap = {
  start: "items-start text-left",
  center: "items-center text-center",
  between: "items-start text-left md:flex-row md:items-center md:justify-between gap-4",
};

export function SectionHeader({
  title,
  description,
  action,
  align = "between",
  className = "",
  ...rest
}: SectionHeaderProps) {
  const layout = alignmentMap[align];
  const composed = ["flex flex-col gap-2", layout, className].filter(Boolean).join(" ");

  return (
    <div className={composed} {...rest}>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{title}</h2>
        {description ? <p className="text-sm text-[var(--color-text-secondary)]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
