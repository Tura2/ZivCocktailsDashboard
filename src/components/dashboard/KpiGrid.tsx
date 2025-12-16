import type { ReactNode } from 'react';

import KpiCard, { type TrendDirection } from '@/components/dashboard/KpiCard';

type KpiItem = {
  key?: string;
  label: string;
  value: string | number;
  trendLabel?: string;
  trendDirection?: TrendDirection;
};

type KpiGridProps = {
  items?: KpiItem[];
  children?: ReactNode;
  className?: string;
};

const gridClasses = 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4';

export default function KpiGrid({ items, children, className = '' }: KpiGridProps) {
  return (
    <div className={`${gridClasses} ${className}`.trim()}>
      {items
        ? items.map((item) => (
            <KpiCard
              key={item.key ?? item.label}
              label={item.label}
              value={item.value}
              trendLabel={item.trendLabel}
              trendDirection={item.trendDirection}
            />
          ))
        : children}
    </div>
  );
}
