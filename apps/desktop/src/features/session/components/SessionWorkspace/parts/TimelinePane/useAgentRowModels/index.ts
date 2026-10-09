import { useContext, useMemo } from 'react';
import type { MeasuredTurnSpan } from '@goodboy/types';
import { WorkTimeContext } from '../../../../../../workTreeModel/workTimeSource';
import { agentKindPalette } from '../../../../../agent-kind';
import type { AgentRowWork } from '../../../../../hooks/useAgentRowWork';
import type { TimelineAgentEntry } from '../../../../../timeline/buildTimelineGroups';
import {
  agentRanModels,
  modelsSummary,
  type AgentModels,
  type ModelsSummary,
} from '../../../../../timeline/ranModels';
import type { RowPhase } from '../../../../../../workTreeModel/rowState';

type Params = {
  readonly entry: TimelineAgentEntry;
  readonly work: AgentRowWork;
  readonly phase: RowPhase;
};

export type AgentRowModels = {
  readonly models: AgentModels;
  readonly summary: ModelsSummary | null;
  readonly kindWord: string;
};

const NO_SPANS: ReadonlyArray<MeasuredTurnSpan> = [];

export const useAgentRowModels = ({ entry, work, phase }: Params): AgentRowModels => {
  const source = useContext(WorkTimeContext);
  const spans = source?.spans ?? NO_SPANS;
  const { provider, model, effort, isPlanned } = work.routing;
  const isLive = phase === 'running';
  const agentId = entry.agent.id;
  const models = useMemo(
    () =>
      agentRanModels({
        spans,
        agentId,
        routing: { provider, model, effort },
        isRoutingPlanned: isPlanned,
        isLive,
      }),
    [spans, agentId, provider, model, effort, isPlanned, isLive],
  );
  const summary = useMemo(() => modelsSummary({ models: models.models }), [models]);
  return { models, summary, kindWord: agentKindPalette({ kind: entry.agentKind }).label };
};
