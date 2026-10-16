import type { ReactNode } from 'react';
import { capTextOf, type AutoBudgetFacts } from '@goodboy/core';
import { formatUsd } from '@goodboy/ui';

type Props = {
  readonly facts: AutoBudgetFacts;
  readonly limitControl: ReactNode | null;
};

type ShareParams = {
  readonly part: number;
  readonly whole: number;
};

const shareOf = ({ part, whole }: ShareParams): number =>
  whole <= 0 ? 0 : Math.min(100, Math.max(0, (part / whole) * 100));

export const AutoTreeBudget = ({ facts, limitControl }: Props) => {
  const whole = facts.capUsd ?? 0;
  const spent = shareOf({ part: facts.spentUsd, whole });
  const reserved = shareOf({ part: facts.reservedUsd, whole });
  return (
    <section aria-label="Tree budget" className="flex shrink-0 flex-col gap-2 px-4 pb-4 pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-eyebrow text-faint-foreground">Tree budget</span>
        {limitControl ?? (
          <span className="text-meta tabular-nums text-faint-foreground">
            {capTextOf({ facts })}
          </span>
        )}
      </div>
      {facts.remainingUsd === null ? null : (
        <div
          role="img"
          aria-label={`Spent ${formatUsd(facts.spentUsd)}, reserved ${formatUsd(facts.reservedUsd)}, left ${formatUsd(facts.remainingUsd)}`}
          className="flex h-1.5 overflow-hidden rounded-full bg-idle"
        >
          <span className="h-full bg-primary" style={{ width: `${spent}%` }} />
          <span className="h-full bg-primary opacity-40" style={{ width: `${reserved}%` }} />
        </div>
      )}
      <div className="flex items-center justify-between gap-2 text-meta tabular-nums text-muted-foreground">
        <span>Spent {formatUsd(facts.spentUsd)}</span>
        <span>Reserved {formatUsd(facts.reservedUsd)}</span>
        {facts.remainingUsd === null ? null : <span>Left {formatUsd(facts.remainingUsd)}</span>}
      </div>
      {facts.hasEstimate ? (
        <p className="text-meta text-faint-foreground">Some costs are estimated.</p>
      ) : null}
    </section>
  );
};
