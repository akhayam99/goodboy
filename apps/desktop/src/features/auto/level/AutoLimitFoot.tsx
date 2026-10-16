import type { AutoBudgetFacts } from '@goodboy/core';
import type { AutoTreeId, SessionId } from '@goodboy/types';
import { formatUsd } from '@goodboy/ui';
import { AutoTreeLimitControl } from '../chat/AutoTreeLimitControl';

type Props = {
  readonly sessionId: SessionId;
  readonly treeId: AutoTreeId;
  readonly facts: AutoBudgetFacts;
};

type FactsParams = {
  readonly facts: AutoBudgetFacts;
};

const restOf = ({ facts }: FactsParams): string =>
  facts.remainingUsd === null
    ? `${formatUsd(facts.spentUsd)} spent`
    : `${formatUsd(facts.remainingUsd)} left`;

export const AutoLimitFoot = ({ sessionId, treeId, facts }: Props) => (
  <section
    aria-label="Limit"
    data-auto-limit-foot=""
    className="flex h-8 min-w-0 shrink-0 items-center gap-1 px-2"
  >
    <AutoTreeLimitControl sessionId={sessionId} treeId={treeId} facts={facts} />
    <span aria-hidden className="text-faint-foreground">
      ·
    </span>
    <span className="truncate text-meta tabular-nums text-muted-foreground">
      {restOf({ facts })}
    </span>
  </section>
);
