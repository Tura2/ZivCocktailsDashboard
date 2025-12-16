import Card from '@/components/dashboard/Card';

export type TrendDirection = 'up' | 'down' | 'neutral';

type KpiCardProps = {
  label: string;
  value: string | number;
  trendLabel?: string;
  trendDirection?: TrendDirection;
  className?: string;
};

const trendClasses: Record<TrendDirection, string> = {
  up: 'bg-green-100 text-green-700',
  down: 'bg-red-100 text-red-600',
  neutral: 'bg-slate-100 text-slate-500',
};

const iconColor: Record<TrendDirection, string> = {
  up: 'text-green-600',
  down: 'text-red-600',
  neutral: 'text-slate-500',
};

export default function KpiCard({
  label,
  value,
  trendLabel,
  trendDirection = 'neutral',
  className = '',
}: KpiCardProps) {
  return (
    <Card className={className}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className="mt-4 flex items-baseline justify-between gap-4">
        <span className="text-2xl font-semibold text-slate-900">{value}</span>
        {trendLabel ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${trendClasses[trendDirection]}`}>
            <svg
              className={`h-3 w-3 ${iconColor[trendDirection]}`}
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              {trendDirection === 'up' && <path d="M5 12l5-5 5 5" />}
              {trendDirection === 'down' && <path d="M5 8l5 5 5-5" />}
              {trendDirection === 'neutral' && <path d="M5 10h10" />}
            </svg>
            {trendLabel}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
