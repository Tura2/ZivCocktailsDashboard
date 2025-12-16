import Card from '@/components/dashboard/Card';
import StatusPill from '@/components/dashboard/StatusPill';

type UpcomingEventStatus = 'confirmed' | 'pending' | 'cancelled';

type UpcomingEvent = {
  name: string;
  date: string;
  type: string;
  status: UpcomingEventStatus;
};

type UpcomingEventsCardProps = {
  events: UpcomingEvent[];
  className?: string;
};

const statusLabel: Record<UpcomingEventStatus, string> = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  cancelled: 'Cancelled',
};

export default function UpcomingEventsCard({ events, className = '' }: UpcomingEventsCardProps) {
  return (
    <Card className={className}>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Upcoming Events</h3>
          <p className="text-sm text-slate-500">Next 10 days</p>
        </div>
        <button className="text-sm font-medium text-indigo-500 transition hover:text-indigo-600">View all</button>
      </header>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                Event
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                Date
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                Type
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {events.map((event) => (
              <tr key={event.name} className="divide-y divide-slate-100 text-slate-600">
                <td className="px-4 py-3 font-medium text-slate-900">{event.name}</td>
                <td className="px-4 py-3">{event.date}</td>
                <td className="px-4 py-3">{event.type}</td>
                <td className="px-4 py-3">
                  <StatusPill variant={event.status} label={statusLabel[event.status]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
