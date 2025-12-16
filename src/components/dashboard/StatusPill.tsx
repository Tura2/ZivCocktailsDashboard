type StatusVariant = 'confirmed' | 'pending' | 'cancelled';

type StatusPillProps = {
  variant: StatusVariant;
  label: string;
};

const variantClasses: Record<StatusVariant, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-red-100 text-red-600',
};

export default function StatusPill({ variant, label }: StatusPillProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${variantClasses[variant]}`}>
      {label}
    </span>
  );
}
