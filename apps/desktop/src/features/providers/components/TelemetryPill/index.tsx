import { formatUsd } from '@goodboy/ui';
import { useAppStore } from '../../../../store';

const EMPTY_SPEND: ReadonlyArray<never> = [];

const PROVIDER_DOT: Record<string, string> = {
  anthropic: 'bg-[var(--color-provider-anthropic)]',
  cursor: 'bg-[var(--color-provider-cursor)]',
  codex: 'bg-[var(--color-provider-codex)]',
  gemini: 'bg-[var(--color-provider-gemini)]',
  opencode: 'bg-[var(--color-provider-opencode)]',
  openrouter: 'bg-[var(--color-provider-openrouter)]',
};

export const TelemetryPill = () => {
  const sessionSummary = useAppStore((s) => s.sessionSummary);
  const workspaceSummary = useAppStore((s) => s.workspaceSummary);
  const providerSpend = useAppStore((s) => s.providerSpendBreakdown ?? EMPTY_SPEND);

  const sessionCost = sessionSummary?.estimatedCostUsd ?? 0;
  const workspaceCost = workspaceSummary?.estimatedCostUsd ?? 0;

  const tooltipLines = [
    `session: ${formatUsd(sessionCost)}`,
    `workspace: ${formatUsd(workspaceCost)}`,
    ...(providerSpend.length > 0
      ? [
          '',
          'per provider:',
          ...providerSpend.map(
            (p) =>
              `· ${p.provider}: ${formatUsd(p.spentUsd)}${p.capUsd !== null ? ` / ${formatUsd(p.capUsd)}` : ''}`,
          ),
        ]
      : []),
  ].join('\n');

  return (
    <>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('goodboy:open-budget-studio'))}
        title={tooltipLines}
        aria-label="open budget studio"
        className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs hover:bg-muted/70"
      >
        <span className="font-medium">{formatUsd(sessionCost)}</span>
        <span className="text-muted-foreground">session</span>
        <span aria-hidden className="text-muted-foreground">
          ·
        </span>
        <span className="font-medium">{formatUsd(workspaceCost)}</span>
        {providerSpend.length > 0 && (
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
        )}
      </button>
    </>
  );
};
