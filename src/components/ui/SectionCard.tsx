import type { ReactNode } from 'react';

import Card from '@/components/dashboard/Card';
import type { CategoryKey } from '@/ui/categoryTheme';
import { getCategoryTheme } from '@/ui/categoryTheme';

type SectionCardProps = {
  category: CategoryKey;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SectionCard({ category, title, subtitle, actions, children, className = '' }: SectionCardProps) {
  const t = getCategoryTheme(category);

  return (
    <Card
      className={[
        'relative overflow-hidden border-l-4',
        t.accentBorderLeft,
        className,
      ].join(' ')}
    >
      <div className={['pointer-events-none absolute inset-x-0 top-0 h-14 opacity-50', t.accentBg].join(' ')} aria-hidden />

      <div className="relative z-10">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={['inline-flex h-2.5 w-2.5 rounded-full', t.accentDot].join(' ')} aria-hidden />
              <h2 className={['text-sm font-semibold uppercase tracking-wide', t.accentText].join(' ')}>{title}</h2>
            </div>
            {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>

        {children}
      </div>
    </Card>
  );
}
