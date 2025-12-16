import Card from '@/components/dashboard/Card';

type EventsOverviewCardProps = {
  title: string;
  subtitle?: string;
  summary?: string;
  chartValues: number[];
  className?: string;
};

const filters = ['7D', '30D', '90D'] as const;
const gridLines = [1, 2, 3, 4];

export default function EventsOverviewCard({ title, subtitle, summary, chartValues, className = '' }: EventsOverviewCardProps) {
  const chartPolylinePoints = chartValues
    .map((value, index) => {
      const x = (index / (chartValues.length - 1)) * 320;
      const y = 180 - value;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Card className={`flex flex-col ${className}`.trim()}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">
          {filters.map((label) => (
            <span key={label} className={`rounded-full px-3 py-1 ${label === '30D' ? 'bg-white text-slate-900 shadow-sm' : ''}`}>
              {label}
            </span>
          ))}
        </div>
      </header>

      <div className="mt-6">
        <div className="relative h-56 rounded-lg border border-slate-200 bg-slate-50">
          {gridLines.map((line) => (
            <span key={line} className="absolute inset-x-0 top-0 h-full" style={{ top: `${(line / (gridLines.length + 1)) * 100}%` }}>
              <span className="block h-px w-full bg-slate-200" />
            </span>
          ))}
          <svg viewBox="0 0 320 180" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <linearGradient id="chartLine" x1="0" y1="0" x2="320" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6366F1" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#6366F1" stopOpacity="0.65" />
              </linearGradient>
            </defs>
            <polyline
              fill="none"
              stroke="url(#chartLine)"
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={chartPolylinePoints}
            />
          </svg>
        </div>
        {summary ? <p className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">{summary}</p> : null}
      </div>
    </Card>
  );
}
