import { cn, formatUsd } from '@goodboy/ui';
import { LayoutDashboard } from 'lucide-react';
import type { ProviderSpendEntry } from '../../../../store';
import { ProviderIcon } from './ProviderIcon';
import { providerLabel, spendBarColor, type BudgetScope, type SessionSpend } from './lib';

type Props = {
  readonly scope: BudgetScope;
  readonly onSelect: (scope: BudgetScope) => void;
  readonly providers: ReadonlyArray<ProviderSpendEntry>;
  readonly sessions: ReadonlyArray<SessionSpend>;
};

export const ScopeRail = ({ scope, onSelect, providers, sessions }: Props) => {
  return (
    <div className="flex flex-col gap-3 p-3">
      <ul className="flex flex-col gap-0.5">
        <li>
          <button
            type="button"
            onClick={() => onSelect({ kind: 'overview' })}
            aria-current={scope.kind === 'overview'}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
              scope.kind === 'overview'
                ? 'bg-primary/10 text-foreground ring-1 ring-primary/30'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <LayoutDashboard size={15} aria-hidden className="shrink-0" />
            <span className="flex-1 text-sm font-medium">Overview</span>
          </button>
        </li>
      </ul>

      {providers.length > 0 ? (
        <div className="flex flex-col gap-1">
          <GroupLabel label="providers" count={providers.length} />
          <ul className="flex flex-col gap-0.5">
            {providers.map((entry) => {
              const active = scope.kind === 'provider' && scope.provider === entry.provider;
              const hasCap = entry.capUsd !== null;
              const pctClamped = Math.min(entry.pct, 1);
              return (
                <li key={entry.provider}>
                  <button
                    type="button"
                    onClick={() => onSelect({ kind: 'provider', provider: entry.provider })}
                    aria-current={active}
                    className={cn(
                      'flex w-full flex-col gap-1.5 rounded-md px-2.5 py-2 text-left transition-colors',
                      active ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50',
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <ProviderIcon provider={entry.provider} size={15} withChip />
                      <span className="flex-1 truncate text-sm font-medium capitalize text-foreground">
                        {providerLabel(entry.provider)}
                      </span>
                      <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
                        {formatUsd(entry.spentUsd)}
                      </span>
                    </div>
                    {hasCap ? (
                      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', spendBarColor(entry.pct))}
                          style={{ width: `${pctClamped * 100}%` }}
                        />
                      </div>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {sessions.length > 0 ? (
        <div className="flex flex-col gap-1">
          <GroupLabel label="sessions" count={sessions.length} />
          <ul className="flex flex-col gap-0.5">
            {sessions.map((s) => {
              const active = scope.kind === 'session' && scope.sessionId === s.sessionId;
              return (
                <li key={s.sessionId}>
                  <button
                    type="button"
                    onClick={() => onSelect({ kind: 'session', sessionId: s.sessionId })}
                    aria-current={active}
                    title={s.goal}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
                      active
                        ? 'bg-primary/10 text-foreground ring-1 ring-primary/30'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    {s.isCurrent ? (
                      <span
                        aria-label="current session"
                        className="size-1.5 shrink-0 rounded-full bg-success"
                      />
                    ) : (
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-border-soft" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm">{s.goal}</span>
                    <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
                      {formatUsd(s.spentUsd)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

function GroupLabel({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-1.5 px-1 pb-0.5">
      <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      {count !== undefined ? (
        <span className="text-2xs tabular-nums text-muted-foreground/50">{count}</span>
      ) : null}
      <span aria-hidden className="ml-1 h-px flex-1 bg-border-soft" />
    </div>
  );
}
