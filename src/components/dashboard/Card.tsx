import type { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
};

const baseClasses = 'rounded-xl border border-slate-200 bg-white p-6 shadow-sm';

export default function Card({ children, className = '' }: CardProps) {
  return <div className={`${baseClasses} ${className}`.trim()}>{children}</div>;
}
