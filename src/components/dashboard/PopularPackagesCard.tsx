import Card from '@/components/dashboard/Card';

type PackageStat = {
  name: string;
  bookings: number;
  progress: number;
};

type PopularPackagesCardProps = {
  packages: PackageStat[];
  className?: string;
};

export default function PopularPackagesCard({ packages, className = '' }: PopularPackagesCardProps) {
  return (
    <Card className={className}>
      <header className="mb-5">
        <h3 className="text-lg font-semibold text-slate-900">Popular Packages</h3>
        <p className="text-sm text-slate-500">Last 30 days</p>
      </header>
      <div className="space-y-4">
        {packages.map((pkg) => (
          <div key={pkg.name} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <p className="font-medium text-slate-700">{pkg.name}</p>
              <span className="text-xs font-semibold text-slate-500">Bookings: {pkg.bookings}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${Math.min(100, Math.max(0, pkg.progress))}%` }}
                aria-hidden
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
