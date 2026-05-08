import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Tooltip, cn } from '@kay-am/ui';
import type { BudgetAlert, BudgetAlertKind } from '@kay-am/types';
import { useAppStore } from '../store';

function alertLabel(alert: BudgetAlert): string {
  const pct = alert.capUsd > 0 ? Math.round((alert.currentUsd / alert.capUsd) * 100) : 0;
  if (alert.kind === 'provider-threshold') {
    return `provider ${alert.provider ?? '?'} budget at ${pct}%`;
  }
  if (alert.kind === 'provider-exceeded') {
    return `provider ${alert.provider ?? '?'} budget exceeded`;
  }
  if (alert.kind === 'session-threshold') {
    return `session budget at ${pct}%`;
  }
  if (alert.kind === 'session-exceeded') {
    return `session budget exceeded`;
  }
  return 'budget alert';
}

function alertKindBadge(kind: BudgetAlertKind): { label: string; className: string } {
  if (kind === 'provider-exceeded' || kind === 'session-exceeded') {
    return { label: 'exceeded', className: 'bg-danger/10 text-danger' };
  }
  return { label: 'threshold', className: 'bg-warning/10 text-warning' };
}

function formatTs(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function AlertCenter() {
  const budgetAlerts = useAppStore((s) => s.budgetAlerts);
  const loadBudgetAlerts = useAppStore((s) => s.loadBudgetAlerts);
  const dismissBudgetAlert = useAppStore((s) => s.dismissBudgetAlert);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void loadBudgetAlerts();
  }, [loadBudgetAlerts]);

  const undismissed = budgetAlerts.filter((a) => a.dismissedAt == null);
  const count = undismissed.length;

  return (
    <div className="relative" role="region" aria-label="alerts" aria-live="polite">
      <Tooltip content="alert center" side="bottom">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'relative flex items-center gap-1.5 rounded-md px-2 py-1 text-xs motion-safe:transition-colors',
            open ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60',
          )}
          aria-label={`alert center${count > 0 ? `, ${count} undismissed` : ''}`}
        >
          <Bell size={13} aria-hidden />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-warning text-2xs font-bold leading-none text-warning-foreground">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>
      </Tooltip>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full z-40 mt-1.5 w-80 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b border-border-soft px-3 py-2">
              <span className="text-xs font-semibold text-foreground">alerts</span>
              <Tooltip content="close" side="left">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="close alert center"
                >
                  <X size={13} aria-hidden />
                </button>
              </Tooltip>
            </div>

            {undismissed.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                no active alerts
              </p>
            ) : (
              <ul className="max-h-72 overflow-y-auto divide-y divide-border-soft">
                {undismissed.map((alert) => {
                  const badge = alertKindBadge(alert.kind);
                  return (
                    <li key={alert.id} className="flex items-start gap-2 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              'rounded px-1 py-0.5 text-2xs font-medium leading-none',
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                          <span className="text-xs font-medium text-foreground">
                            {alertLabel(alert)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            ${alert.currentUsd.toFixed(2)} / ${alert.capUsd.toFixed(2)}
                          </span>
                          <span>·</span>
                          <span>{formatTs(alert.createdAt)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="mt-0.5 shrink-0 text-2xs text-muted-foreground underline-offset-2 hover:text-danger hover:underline"
                        onClick={() => void dismissBudgetAlert(alert.id)}
                      >
                        dismiss
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
