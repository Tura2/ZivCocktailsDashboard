type TopBarProps = {
  title: string;
  subtitle?: string;
  className?: string;
};

export default function TopBar({ title, subtitle, className = '' }: TopBarProps) {
  return (
    <header className={`border-b border-slate-200 bg-slate-100/80 px-4 py-6 backdrop-blur sm:px-6 lg:px-10 ${className}`.trim()}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Control center</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <button className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900">
            This week
            <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path d="M6 8l4 4 4-4" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <label className="hidden items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 lg:flex">
              <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <circle cx="9" cy="9" r="6" />
                <path d="M15 15l4 4" />
              </svg>
              <input
                type="search"
                placeholder="Search events, clients…"
                className="w-48 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </label>
            <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:text-indigo-500">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="absolute right-2 top-2 inline-flex h-2 w-2 rounded-full bg-red-500" aria-hidden />
            </button>
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700">
              ZA
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
