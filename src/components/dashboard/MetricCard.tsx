import { useEffect, useMemo, useRef, useState } from 'react';
import * as HoverCard from '@radix-ui/react-hover-card';

import type { CategoryKey } from '@/ui/categoryTheme';
import { getCategoryTheme } from '@/ui/categoryTheme';
import Card from '@/components/dashboard/Card';
import { useMetricBreakdown } from '@/hooks/useMetricBreakdown';
import { BreakdownTooltip } from '@/components/dashboard/BreakdownTooltip';
import type { MetricKey } from '@/types/metrics';

export type TrendDirection = 'up' | 'down' | 'neutral';

type MetricCardProps = {
  snapshotId: string | null | undefined;
  snapshotVersion?: string | null;
  metricKey: MetricKey | null | undefined;
  label: string;
  value: string | number;
  trendLabel?: string;
  trendDirection?: TrendDirection;
  hideTrend?: boolean;
  category?: CategoryKey;
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

const OPEN_DELAY_MS = 200;

/**
 * KPI card with an optional calculation breakdown HoverCard.
 */
export default function MetricCard({
  snapshotId,
  snapshotVersion = null,
  metricKey,
  label,
  value,
  trendLabel,
  trendDirection = 'neutral',
  hideTrend = false,
  category,
  className = '',
}: MetricCardProps) {
  const t = category ? getCategoryTheme(category) : null;

  const { state, breakdown, trigger } = useMetricBreakdown(snapshotId, metricKey, snapshotVersion);

  const [open, setOpen] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const canAttemptOpen = useMemo(() => {
    if (disabled) return false;
    if (!snapshotId || !metricKey) return false;
    if (state.status === 'disabled') return false;
    return true;
  }, [disabled, metricKey, snapshotId, state.status]);

  useEffect(() => {
    // If we learned there is no breakdown (doc missing or kind none), permanently disable.
    if (state.status === 'missing') {
      setDisabled(true);
      setOpen(false);
    }
  }, [state.status]);

  useEffect(() => {
    // A refresh changes computedAt; allow re-trying breakdown fetches without requiring an app restart.
    setDisabled(false);
  }, [snapshotVersion]);

  const onPointerEnter = () => {
    if (!canAttemptOpen) return;

    // Start fetching as early as possible.
    trigger();

    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;

    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => {
      setOpen(true);
    }, OPEN_DELAY_MS);
  };

  const scheduleClose = () => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = null;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    // Small delay lets the user move from trigger -> tooltip without it disappearing.
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  };

  const onPointerLeave = () => {
    scheduleClose();
  };

  const onFocus = () => {
    // Keyboard users get the same behavior.
    onPointerEnter();
  };

  const onBlur = () => {
    scheduleClose();
  };

  const onTooltipPointerEnter = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setOpen(true);
  };

  const onTooltipPointerLeave = () => {
    scheduleClose();
  };

  const tooltipStatus: 'loading' | 'ready' | 'error' = useMemo(() => {
    if (state.status === 'ready') return 'ready';
    if (state.status === 'error') return 'error';
    return 'loading';
  }, [state.status]);

  const tooltipError = state.status === 'error' ? state.error : undefined;

  const cardUi = (
    <div onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onFocus={onFocus} onBlur={onBlur}>
      <Card className={['p-4', className].join(' ').trim()}>
        <div className="flex items-start gap-2">
          {t ? <span className={['h-2 w-2 rounded-full', t.accentDot].join(' ')} aria-hidden /> : null}
          <p className="text-sm font-medium leading-snug text-slate-500">{label}</p>
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <span className="text-2xl font-semibold tabular-nums text-slate-900">{value}</span>
          {!hideTrend && trendLabel ? (
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
    </div>
  );

  // If there is no Firestore, no snapshot, or we know there's no breakdown -> plain card.
  if (!canAttemptOpen) return cardUi;

  return (
    <HoverCard.Root open={open} onOpenChange={setOpen}>
      <HoverCard.Trigger asChild>{cardUi}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          sideOffset={10}
          collisionPadding={12}
          onPointerEnter={onTooltipPointerEnter}
          onPointerLeave={onTooltipPointerLeave}
          className="z-50 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-md ring-1 ring-slate-100"
        >
          <BreakdownTooltip title={label} status={tooltipStatus} breakdown={breakdown} errorMessage={tooltipError} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
