import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@kay-am/ui';
import type { TelemetryRecord } from '@kay-am/types';
import { useAppStore } from '../store';
import type { ProviderSpendEntry } from '../store';

const EMPTY_TELEMETRY: ReadonlyArray<TelemetryRecord> = [];

const formatCost = (usd: number): string => `$${usd.toFixed(4)}`;
const formatTokens = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}k`
      : `${n}`;

type SortKey = 'recent' | 'expensive';

const SORT_KEY_STORAGE = 'telemetry-sort-key';

function spendColor(pct: number): string {
  if (pct >= 1) return 'bg-danger';
  if (pct >= 0.8) return 'bg-warning';
  return 'bg-muted-foreground';
}

function spendTextColor(pct: number, hasCap: boolean): string {
  if (!hasCap) return 'text-foreground';
  if (pct >= 1) return 'text-danger';
  if (pct >= 0.8) return 'text-warning';
  return 'text-foreground';
}

function ProviderSpendRow({ entry }: { entry: ProviderSpendEntry }) {
  const label = entry.provider === 'anthropic' ? 'claude' : entry.provider;
  const hasCap = entry.capUsd !== null;
  const pctClamped = Math.min(entry.pct, 1);

  return (
    <li className="flex flex-col gap-0.5 py-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium capitalize">{label}</span>
        <span className={cn('font-mono text-xs', spendTextColor(entry.pct, hasCap))}>
          {formatCost(entry.spentUsd)}
          {hasCap ? ` / ${formatCost(entry.capUsd!)}` : null}
        </span>
      </div>
      {hasCap ? (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full motion-safe:transition-all', spendColor(entry.pct))}
            style={{ width: `${pctClamped * 100}%` }}
          />
        </div>
      ) : null}
    </li>
  );
}

export function TelemetryPill() {
  const sessionSummary = useAppStore((s) => s.sessionSummary);
  const workspaceSummary = useAppStore((s) => s.workspaceSummary);
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const sessionTelemetry = useAppStore((s) =>
    currentSessionId ? (s.sessionTelemetry[currentSessionId] ?? EMPTY_TELEMETRY) : EMPTY_TELEMETRY,
  );
  const providerSpendBreakdown = useAppStore((s) => s.providerSpendBreakdown);

  const [open, setOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const stored = localStorage.getItem(SORT_KEY_STORAGE);
    return stored === 'expensive' ? 'expensive' : 'recent';
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const sorted = useMemo(() => {
    const copy = [...sessionTelemetry];
    if (sortKey === 'expensive') {
      copy.sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd);
    } else {
      copy.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
    }
    return copy;
  }, [sessionTelemetry, sortKey]);

  const handleSortKey = (key: SortKey) => {
    setSortKey(key);
    localStorage.setItem(SORT_KEY_STORAGE, key);
  };

  const summarizerCost = sessionTelemetry
    .filter((r) => r.kind === 'summarizer')
    .reduce((sum, r) => sum + r.estimatedCostUsd, 0);

  const hasMultipleProviders = providerSpendBreakdown.length >= 2;

  const modelBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { provider: string; model: string; tokensIn: number; tokensOut: number; spentUsd: number }
    >();
    for (const r of sessionTelemetry) {
      const key = `${r.provider}//${r.model}`;
      const prev = map.get(key) ?? {
        provider: r.provider,
        model: r.model,
        tokensIn: 0,
        tokensOut: 0,
        spentUsd: 0,
      };
      prev.tokensIn += r.inputTokens;
      prev.tokensOut += r.outputTokens;
      prev.spentUsd += r.estimatedCostUsd;
      map.set(key, prev);
    }
    return [...map.values()].sort((a, b) => b.spentUsd - a.spentUsd);
  }, [sessionTelemetry]);

  const sessionCost = sessionSummary?.estimatedCostUsd ?? 0;
  const workspaceCost = workspaceSummary?.estimatedCostUsd ?? 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-2 py-0.5 text-xs hover:bg-muted/70"
      >
        <span className="font-medium">{formatCost(sessionCost)}</span>
        <span className="text-muted-foreground">session</span>
        <span aria-hidden className="text-muted-foreground">
          ·
        </span>
        <span className="font-medium">{formatCost(workspaceCost)}</span>
        <span className="text-muted-foreground">total</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-7 z-10 w-80 rounded-lg border border-border bg-background p-4 text-xs shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold uppercase tracking-wide text-muted-foreground">
              breakdown
            </span>
            <div className="flex gap-1">
              <SortChip
                active={sortKey === 'recent'}
                onClick={() => handleSortKey('recent')}
                label="recent"
              />
              <SortChip
                active={sortKey === 'expensive'}
                onClick={() => handleSortKey('expensive')}
                label="expensive"
              />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-b border-border pb-2">
            <dt className="text-muted-foreground">session</dt>
            <dd className="text-right font-medium">{formatCost(sessionCost)}</dd>
            <dt className="text-muted-foreground">workspace</dt>
            <dd className="text-right font-medium">{formatCost(workspaceCost)}</dd>
            {summarizerCost > 0 ? (
              <>
                <dt className="text-muted-foreground">summarizer</dt>
                <dd className="text-right font-medium">{formatCost(summarizerCost)}</dd>
              </>
            ) : null}
          </dl>

          {providerSpendBreakdown.length > 0 ? (
            <div className="mt-2 border-b border-border pb-2">
              <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                by provider
              </p>
              <ul className="flex flex-col divide-y divide-border">
                {providerSpendBreakdown.map((entry) => (
                  <ProviderSpendRow key={entry.provider} entry={entry} />
                ))}
              </ul>
            </div>
          ) : null}

          {modelBreakdown.length > 0 ? (
            <div className="mt-2 border-b border-border pb-2">
              <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                by model
              </p>
              <ul className="flex flex-col divide-y divide-border">
                {modelBreakdown.map((entry) => (
                  <li
                    key={`${entry.provider}//${entry.model}`}
                    className="flex flex-col gap-0.5 py-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="rounded bg-muted px-1 text-2xs uppercase text-muted-foreground">
                          {entry.provider === 'anthropic' ? 'cl' : entry.provider.slice(0, 2)}
                        </span>
                        <span className="truncate font-mono text-2xs">{entry.model}</span>
                      </span>
                      <span className="font-mono text-xs">{formatCost(entry.spentUsd)}</span>
                    </div>
                    <div className="text-2xs text-muted-foreground">
                      {formatTokens(entry.tokensIn)}↓ / {formatTokens(entry.tokensOut)}↑
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-2 max-h-64 overflow-y-auto">
            {sorted.length === 0 ? (
              <p className="py-2 text-muted-foreground">no recorded turns yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {sorted.map((record) => (
                  <li key={record.id} className="flex items-center justify-between gap-2 py-0.5">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <span
                        className={cn(
                          'rounded px-1 text-2xs uppercase',
                          record.kind === 'summarizer'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-primary/10 text-primary',
                        )}
                      >
                        {record.kind}
                      </span>
                      {hasMultipleProviders ? (
                        <span className="rounded bg-muted px-1 text-2xs text-muted-foreground">
                          {record.provider === 'anthropic' ? 'claude' : record.provider}
                        </span>
                      ) : null}
                      <span>
                        {formatTokens(record.inputTokens)}↓ / {formatTokens(record.outputTokens)}↑
                      </span>
                    </span>
                    <span className="font-mono">{formatCost(record.estimatedCostUsd)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SortChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded px-1.5 py-0.5 text-2xs uppercase tracking-wide',
        active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
      )}
    >
      {label}
    </button>
  );
}
