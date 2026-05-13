import { useState } from 'react';
import { useAppStore } from '../store';
import { PricingDialog } from './PricingDialog';

const EMPTY_SPEND: ReadonlyArray<never> = [];

const formatCost = (usd: number): string => (usd === 0 ? '$0' : `$${usd.toFixed(2)}`);

const PROVIDER_DOT: Record<string, string> = {
  anthropic: 'bg-[var(--color-provider-anthropic)]',
  cursor: 'bg-[var(--color-provider-cursor)]',
  codex: 'bg-[var(--color-provider-codex)]',
  opencode: 'bg-[var(--color-provider-opencode)]',
};

export function TelemetryPill() {
  const sessionSummary = useAppStore((s) => s.sessionSummary);
  const workspaceSummary = useAppStore((s) => s.workspaceSummary);
  const providerSpend = useAppStore((s) => s.providerSpendBreakdown ?? EMPTY_SPEND);
  const [open, setOpen] = useState(false);

  const sessionCost = sessionSummary?.estimatedCostUsd ?? 0;
  const workspaceCost = workspaceSummary?.estimatedCostUsd ?? 0;

  const tooltipLines = [
    `session: ${formatCost(sessionCost)}`,
    `workspace: ${formatCost(workspaceCost)}`,
    ...(providerSpend.length > 0
      ? [
          '',
          'per provider:',
          ...providerSpend.map(
            (p) =>
              `· ${p.provider}: ${formatCost(p.spentUsd)}${p.capUsd !== null ? ` / ${formatCost(p.capUsd)}` : ''}`,
          ),
        ]
      : []),
  ].join('\n');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={tooltipLines}
        aria-label="open pricing breakdown"
        className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs hover:bg-muted/70"
      >
        <span className="font-medium">{formatCost(sessionCost)}</span>
        <span className="text-muted-foreground">session</span>
        <span aria-hidden className="text-muted-foreground">
          ·
        </span>
        <span className="font-medium">{formatCost(workspaceCost)}</span>
        {providerSpend.length > 0 ? (
          <span aria-hidden className="ml-1 flex items-center -space-x-0.5">
            {providerSpend
              .filter((p) => p.spentUsd > 0)
              .slice(0, 3)
              .map((p) => (
                <span
                  key={p.provider}
                  className={`inline-block h-2 w-2 rounded-full ring-1 ring-muted ${PROVIDER_DOT[p.provider] ?? 'bg-muted-foreground/40'}`}
                />
              ))}
          </span>
        ) : null}
      </button>
      <PricingDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
