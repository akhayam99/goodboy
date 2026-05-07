import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@kay-am/ui';
import type { TelemetryRecord } from '@kay-am/types';
import { useAppStore } from '../store';

const EMPTY_TELEMETRY: ReadonlyArray<TelemetryRecord> = [];

const formatCost = (usd: number): string => `$${usd.toFixed(4)}`;
const formatTokens = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}k`
      : `${n}`;

type SortKey = 'time' | 'cost';

interface ProviderBreakdown {
  readonly provider: string;
  readonly cost: number;
}

function buildProviderBreakdown(
  records: ReadonlyArray<TelemetryRecord>,
): ReadonlyArray<ProviderBreakdown> {
  const map = new Map<string, number>();
  for (const r of records) {
    map.set(r.provider, (map.get(r.provider) ?? 0) + r.estimatedCostUsd);
  }
  return Array.from(map.entries())
    .map(([provider, cost]) => ({ provider, cost }))
    .sort((a, b) => b.cost - a.cost);
}

export function TelemetryPill() {
  const sessionSummary = useAppStore((s) => s.sessionSummary);
  const workspaceSummary = useAppStore((s) => s.workspaceSummary);
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const sessionTelemetry = useAppStore((s) =>
    currentSessionId ? (s.sessionTelemetry[currentSessionId] ?? EMPTY_TELEMETRY) : EMPTY_TELEMETRY,
  );

  const [open, setOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('time');
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
    if (sortKey === 'cost') {
      copy.sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd);
    } else {
      copy.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
    }
    return copy;
  }, [sessionTelemetry, sortKey]);

  const summarizerCost = sessionTelemetry
    .filter((r) => r.kind === 'summarizer')
    .reduce((sum, r) => sum + r.estimatedCostUsd, 0);

  const providerBreakdown = useMemo(
    () => buildProviderBreakdown(sessionTelemetry),
    [sessionTelemetry],
  );
  const hasMultipleProviders = providerBreakdown.length >= 2;

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
        <div className="absolute right-0 top-7 z-10 w-80 rounded-md border border-border bg-background p-3 text-xs shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold uppercase tracking-wide text-muted-foreground">
              breakdown
            </span>
            <div className="flex gap-1">
              <SortChip
                active={sortKey === 'time'}
                onClick={() => setSortKey('time')}
                label="time"
              />
              <SortChip
                active={sortKey === 'cost'}
                onClick={() => setSortKey('cost')}
                label="cost"
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
            {hasMultipleProviders
              ? providerBreakdown.map(({ provider, cost }) => (
                  <>
                    <dt key={`dt-${provider}`} className="text-muted-foreground">
                      via {provider === 'anthropic' ? 'claude' : provider}
                    </dt>
                    <dd key={`dd-${provider}`} className="text-right font-medium">
                      {formatCost(cost)}
                    </dd>
                  </>
                ))
              : null}
          </dl>

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
                          'rounded px-1 text-[10px] uppercase',
                          record.kind === 'summarizer'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-primary/10 text-primary',
                        )}
                      >
                        {record.kind}
                      </span>
                      {hasMultipleProviders ? (
                        <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
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
        'rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
        active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
      )}
    >
      {label}
    </button>
  );
}
