import type { ReactNode } from 'react';

import KpiCard, { type TrendDirection } from '@/components/dashboard/KpiCard';
import type { CategoryKey } from '@/ui/categoryTheme';

type KpiItem = {
  key?: string;
  label: string;
  value: string | number;
  trendLabel?: string;
  trendDirection?: TrendDirection;
  hideTrend?: boolean;
  category?: CategoryKey;
};

type KpiGridProps = {
  items?: KpiItem[];
  children?: ReactNode;
  className?: string;
};

// Default grid is intentionally conservative (1–2 cols) so KPI cards don't get too narrow.
// Pages that have wider surfaces can opt into more columns via `className`.
const defaultGridClasses = 'grid grid-cols-1 gap-4 sm:grid-cols-2';

export default function KpiGrid({ items, children, className = '' }: KpiGridProps) {
  return (
    <div className={`${defaultGridClasses} ${className}`.trim()}>
      {items
        ? items.map((item) => (
            <KpiCard
              key={item.key ?? item.label}
              label={item.label}
              value={item.value}
              trendLabel={item.trendLabel}
              trendDirection={item.trendDirection}
              hideTrend={item.hideTrend}
              category={item.category}
            />
          ))
        : children}
    </div>
  );
}
