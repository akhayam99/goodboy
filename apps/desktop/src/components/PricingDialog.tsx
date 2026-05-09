import { useMemo, useState } from 'react';
import { Dialog, cn } from '@kay-am/ui';
import { useAppStore } from '../store';
import type { ProviderSpendEntry } from '../store';

const formatCost = (usd: number): string => `$${usd.toFixed(4)}`;
const formatTokens = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}k`
      : `${n}`;

type SortKey = 'recent' | 'expensive';
const SORT_KEY_STORAGE = 'pricing-sort-key';

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
    <li className="flex flex-col gap-1 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium capitalize">{label}</span>
        <span className={cn('font-mono text-sm', spendTextColor(entry.pct, hasCap))}>
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

interface PricingDialogProps {
  open: boolean;
  onClose: () => void;
}

const EMPTY_TELEMETRY: ReadonlyArray<{
  id: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  recordedAt: string;
  kind: 'turn' | 'summarizer';
}> = [];

export function PricingDialog({ open, onClose }: PricingDialogProps) {
  const sessionSummary = useAppStore((s) => s.sessionSummary);
  const workspaceSummary = useAppStore((s) => s.workspaceSummary);
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const sessionTelemetry = useAppStore(
    (s) => (currentSessionId ? s.sessionTelemetry[currentSessionId] : undefined) ?? EMPTY_TELEMETRY,
  );
  const providerSpendBreakdown = useAppStore((s) => s.providerSpendBreakdown);

  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const stored = localStorage.getItem(SORT_KEY_STORAGE);
    return stored === 'expensive' ? 'expensive' : 'recent';
  });

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
    <Dialog open={open} onClose={onClose} size="lg" title="pricing">
      <div className="flex flex-col gap-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <CostStat label="current session" value={formatCost(sessionCost)} />
          <CostStat label="workspace total" value={formatCost(workspaceCost)} />
        </div>

        {summarizerCost > 0 ? (
          <div className="rounded-md bg-subtle px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{formatCost(summarizerCost)}</span> spent
            on summarizer turns this session
          </div>
        ) : null}

        {providerSpendBreakdown.length > 0 ? (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              by provider
            </h3>
            <ul className="flex flex-col divide-y divide-border-soft">
              {providerSpendBreakdown.map((entry) => (
                <ProviderSpendRow key={entry.provider} entry={entry} />
              ))}
            </ul>
          </section>
        ) : null}

        {modelBreakdown.length > 0 ? (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              by model
            </h3>
            <table className="w-full table-fixed text-left text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="w-1/3 py-1 font-normal">provider · model</th>
                  <th className="py-1 text-right font-normal">in tokens</th>
                  <th className="py-1 text-right font-normal">out tokens</th>
                  <th className="py-1 text-right font-normal">cost</th>
                </tr>
              </thead>
              <tbody>
                {modelBreakdown.map((entry) => (
                  <tr
                    key={`${entry.provider}//${entry.model}`}
                    className="border-t border-border-soft"
                  >
                    <td className="py-1.5">
                      <span className="mr-1 rounded bg-muted px-1 text-2xs uppercase text-muted-foreground">
                        {entry.provider === 'anthropic' ? 'cl' : entry.provider.slice(0, 2)}
                      </span>
                      <span className="font-mono">{entry.model}</span>
                    </td>
                    <td className="py-1.5 text-right font-mono">{formatTokens(entry.tokensIn)}</td>
                    <td className="py-1.5 text-right font-mono">{formatTokens(entry.tokensOut)}</td>
                    <td className="py-1.5 text-right font-mono">{formatCost(entry.spentUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <section>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              turns
            </h3>
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
          <div className="max-h-72 overflow-y-auto">
            {sorted.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">no recorded turns yet.</p>
            ) : (
              <ul className="flex flex-col">
                {sorted.map((record) => (
                  <li
                    key={record.id}
                    className="flex items-center justify-between gap-2 border-t border-border-soft py-1.5 text-xs"
                  >
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
        </section>
      </div>
    </Dialog>
  );
}

function CostStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-subtle px-3 py-2">
      <div className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-base">{value}</div>
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
