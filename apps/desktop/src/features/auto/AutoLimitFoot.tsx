import type { AutoBudgetFacts } from '@goodboy/core';
import type { AutoTreeId, SessionId } from '@goodboy/types';
import { formatUsd } from '@goodboy/ui';
import { useAppStore } from '../../store';
import { AutoTreeLimitControl } from './chat/AutoTreeLimitControl';
import { capLabelOf } from './chat/capLabelOf';
import { joinFacts } from '../../shared/utils/joinFacts';

type Props = {
  readonly sessionId: SessionId;
  readonly treeId: AutoTreeId;
  readonly facts: AutoBudgetFacts;
};

type FactsParams = {
  readonly facts: AutoBudgetFacts;
};

const CENT = 0.005;

const restOf = ({ facts }: FactsParams): string | null => {
  if (facts.remainingUsd === null) {
    return facts.spentUsd < CENT ? null : `${formatUsd(facts.spentUsd)} spent`;
  }
  return facts.remainingUsd < CENT ? 'Limit reached' : `${formatUsd(facts.remainingUsd)} left`;
};

export const AutoLimitFoot = ({ sessionId, treeId, facts }: Props) => {
  const turns = useAppStore(
    (state) =>
      (state.autoTreeViews[sessionId] ?? []).find((view) => view.tree.id === treeId)?.tree
        .turnsUsed ?? null,
  );
  return (
    <section
      aria-label="Limit"
      data-auto-limit-foot=""
      className="flex h-8 min-w-0 shrink-0 items-center"
    >
      <AutoTreeLimitControl
        sessionId={sessionId}
        treeId={treeId}
        facts={facts}
        turns={turns}
        triggerText={joinFacts({ facts: [capLabelOf({ facts }), restOf({ facts })] })}
      />
    </section>
  );
};
