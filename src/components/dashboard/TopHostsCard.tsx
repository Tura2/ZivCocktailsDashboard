import Card from '@/components/dashboard/Card';

type Host = {
  name: string;
  role: string;
  events: number;
  rating: number;
  tips: string;
};

type TopHostsCardProps = {
  hosts: Host[];
  className?: string;
};

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function TopHostsCard({ hosts, className = '' }: TopHostsCardProps) {
  return (
    <Card className={className}>
      <header className="mb-5">
        <h3 className="text-lg font-semibold text-slate-900">Top Hosts</h3>
        <p className="text-sm text-slate-500">Based on ratings &amp; completed events</p>
      </header>
      <ul className="space-y-4">
        {hosts.map((host) => (
          <li
            key={host.name}
            className="flex flex-col gap-4 rounded-lg border border-slate-200/80 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600">
                {getInitials(host.name)}
              </span>
              <div>
                <p className="font-medium text-slate-900">{host.name}</p>
                <p className="text-sm text-slate-500">{host.role}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1">Events: {host.events}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">Rating: {host.rating.toFixed(1)}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">Tips: {host.tips}</span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
