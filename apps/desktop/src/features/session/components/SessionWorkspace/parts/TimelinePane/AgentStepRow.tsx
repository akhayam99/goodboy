import type { ReactNode } from 'react';
import { WORK_ROW } from '@goodboy/ui';
import type { EffortLevel, ProviderId, RoleModelPreferences, Step } from '@goodboy/types';
import { useAgentRowWork, type AgentRowWork } from '../../../../hooks/useAgentRowWork';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import { AgentRowMeta } from './AgentRowMeta';
import { agentRowIdentity } from './AgentRowIdentity';
import { TimelineRoleGlyph } from './TimelineRoleGlyph';
import { TimelineRowStateLine } from './TimelineRowStateLine';
import { useAgentRowModels } from './useAgentRowModels';
import { useRowCard, type RowCard } from './useRowCard';

type AgentStepRowSlots = {
  readonly work: AgentRowWork;
  readonly glyph: ReactNode;
  readonly state: ReactNode;
  readonly meta: ReactNode;
  readonly cardHandlers: RowCard['handlers'];
};

type Props = {
  readonly item: TimelineRowItem;
  readonly entry: TimelineAgentEntry;
  readonly step: Step | null;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: EffortLevel | null;
  readonly costUsd: number;
  readonly onOpen: () => void;
  readonly children: (slots: AgentStepRowSlots) => ReactNode;
};

export const AgentStepRow = ({
  item,
  entry,
  step,
  roleModels,
  sessionProvider,
  sessionEffort,
  costUsd,
  onOpen,
  children,
}: Props) => {
  const phase = item.rowState.phase;
  const work = useAgentRowWork({
    agent: entry.agent,
    kind: entry.agentKind,
    step,
    roleModels,
    sessionProvider,
    sessionEffort,
    phase,
  });
  const rowModels = useAgentRowModels({ entry, work, phase });
  const identity = agentRowIdentity({
    entry,
    ordinal: item.ordinal,
    step,
    work,
    rowModels,
    phase,
    costUsd,
  });
  const card = useRowCard({ isEnabled: identity.hasGlyph });
  return children({
    work,
    glyph: identity.hasGlyph ? (
      <span className={WORK_ROW.pointerLayer} onClick={onOpen}>
        <TimelineRoleGlyph kind={entry.agentKind} identity={identity} isCardOpen={card.isOpen} />
      </span>
    ) : null,
    state: <TimelineRowStateLine state={item.rowState} />,
    meta: (
      <span className={WORK_ROW.pointerLayer} onClick={onOpen}>
        <AgentRowMeta
          entry={entry}
          ordinal={item.ordinal}
          work={work}
          rowModels={rowModels}
          costUsd={costUsd}
          isRunning={phase === 'running'}
        />
      </span>
    ),
    cardHandlers: card.handlers,
  });
};
