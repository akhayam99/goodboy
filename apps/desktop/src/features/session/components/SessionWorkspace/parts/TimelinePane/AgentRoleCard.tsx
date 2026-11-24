import { RoleCard } from '../../../../../workTreeModel/RoleCard';
import type { RowPhase } from '../../../../../workTreeModel/rowState';
import type { AgentRowWork } from '../../../../hooks/useAgentRowWork';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';
import type { AgentModels } from '../../../../timeline/ranModels';
import { TimelineProviderGlyph } from './TimelineProviderGlyph';
import type { CardTrigger } from './timelineRowIdentity';
import { useRowPosition } from './useRowPosition';

type Props = {
  readonly entry: TimelineAgentEntry;
  readonly ordinal: string | null;
  readonly kindWord: string;
  readonly models: AgentModels;
  readonly work: AgentRowWork;
  readonly phase: RowPhase;
  readonly costUsd: number;
  readonly isOpen?: boolean;
  readonly children: CardTrigger;
};

export const AgentRoleCard = ({
  entry,
  ordinal,
  kindWord,
  models,
  work,
  phase,
  costUsd,
  isOpen = false,
  children,
}: Props) => {
  const position = useRowPosition({ entry, ordinal });
  return (
    <RoleCard
      entry={entry}
      position={position}
      kindWord={kindWord}
      models={models}
      routing={work.routing}
      time={work.time}
      phase={phase}
      costUsd={costUsd}
      markOf={({ provider }) => <TimelineProviderGlyph provider={provider} />}
      isOpen={isOpen}
    >
      {children}
    </RoleCard>
  );
};
