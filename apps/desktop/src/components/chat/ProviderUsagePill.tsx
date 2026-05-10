import { Gauge } from 'lucide-react';
import { cn } from '@kay-am/ui';
import type { ProviderId } from '@kay-am/types';
import { useAppStore } from '../../store';

function nextMonthlyResetLabel(now = new Date()): string {
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toLowerCase();
}

export function ProviderUsagePill({ provider }: { provider: ProviderId }) {
  const breakdown = useAppStore((s) => s.providerSpendBreakdown);
  const entry = breakdown.find((e) => e.provider === provider);
  if (!entry || entry.capUsd === null || entry.capUsd <= 0) return null;
  const pctUsed = Math.max(0, Math.min(1, entry.pct));
  const pctRemaining = Math.round((1 - pctUsed) * 100);
  const tone =
    pctRemaining > 50 ? 'text-success' : pctRemaining > 20 ? 'text-warning' : 'text-danger';
  const reset = nextMonthlyResetLabel();
  const tooltip = `${provider}: $${entry.spentUsd.toFixed(2)} / $${entry.capUsd.toFixed(2)} used (${Math.round(pctUsed * 100)}%) · resets ${reset}`;
  return (
    <span
      title={tooltip}
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-2xs',
        tone,
      )}
    >
      <Gauge size={10} aria-hidden />
      {pctRemaining}% left · {reset}
    </span>
  );
}
