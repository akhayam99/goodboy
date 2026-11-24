import type { Step } from '@goodboy/types';
import type { RowState } from '../../../../../workTreeModel/rowState';
import type { AgentRowWork } from '../../../../hooks/useAgentRowWork';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';
import type { AgentRowModels } from './useAgentRowModels';
import { AgentRoleCard } from './AgentRoleCard';
import type { TimelineRowIdentity } from './timelineRowIdentity';

type Params = {
  readonly entry: TimelineAgentEntry;
  readonly ordinal: string | null;
  readonly step: Step | null;
  readonly work: AgentRowWork;
  readonly rowModels: AgentRowModels;
  readonly rowState: RowState;
  readonly costUsd: number;
};

export const agentRowIdentity = ({
  entry,
  ordinal,
  step,
  work,
  rowModels,
  rowState,
  costUsd,
}: Params): TimelineRowIdentity => {
  const { models, kindWord } = rowModels;
  const last = models.models[models.models.length - 1] ?? null;
  const hasRole = !(
    entry.agent.parentAgentId == null &&
    entry.agent.stepId != null &&
    step?.role == null &&
    entry.agentKind === 'generic'
  );
  return {
    hasGlyph: hasRole,
    roleLabel: kindWord,
    summary: hasRole
      ? [last?.name, last?.effort].filter((part) => part != null).join(', ') || null
      : null,
    wrapCard: ({ children, isOpen }) => (
      <AgentRoleCard
        entry={entry}
        ordinal={ordinal}
        kindWord={kindWord}
        models={models}
        work={work}
        rowState={rowState}
        costUsd={costUsd}
        isOpen={isOpen}
      >
        {children}
      </AgentRoleCard>
    ),
  };
};
