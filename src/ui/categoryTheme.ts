export type CategoryKey = 'financial' | 'marketing' | 'sales' | 'operations';

export type CategoryTheme = {
  label: string;
  accentText: string;
  accentBg: string;
  accentBorder: string;
  accentBorderLeft: string;
  accentRing: string;
  accentBar: string;
  accentDot: string;
};

export const categoryTheme: Record<CategoryKey, CategoryTheme> = {
  financial: {
    label: 'Financial',
    accentText: 'text-emerald-700',
    accentBg: 'bg-emerald-50',
    accentBorder: 'border-emerald-200',
    accentBorderLeft: 'border-l-emerald-500',
    accentRing: 'ring-emerald-200',
    accentBar: 'bg-emerald-500',
    accentDot: 'bg-emerald-500',
  },
  marketing: {
    label: 'Marketing',
    accentText: 'text-fuchsia-700',
    accentBg: 'bg-fuchsia-50',
    accentBorder: 'border-fuchsia-200',
    accentBorderLeft: 'border-l-fuchsia-500',
    accentRing: 'ring-fuchsia-200',
    accentBar: 'bg-fuchsia-500',
    accentDot: 'bg-fuchsia-500',
  },
  sales: {
    label: 'Sales',
    accentText: 'text-indigo-700',
    accentBg: 'bg-indigo-50',
    accentBorder: 'border-indigo-200',
    accentBorderLeft: 'border-l-indigo-500',
    accentRing: 'ring-indigo-200',
    accentBar: 'bg-indigo-500',
    accentDot: 'bg-indigo-500',
  },
  operations: {
    label: 'Operations',
    accentText: 'text-amber-800',
    accentBg: 'bg-amber-50',
    accentBorder: 'border-amber-200',
    accentBorderLeft: 'border-l-amber-500',
    accentRing: 'ring-amber-200',
    accentBar: 'bg-amber-500',
    accentDot: 'bg-amber-500',
  },
};

export function getCategoryTheme(category: CategoryKey) {
  return categoryTheme[category];
}
