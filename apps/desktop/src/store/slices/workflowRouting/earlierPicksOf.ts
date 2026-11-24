import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { KIND_TO_ROLE, classifyAgent } from '../../../features/session/agent-kind';
import type { AppStore } from '../../store';
import type { RoutedPick } from './writerFamilyOf';

type Params = {
  readonly state: Pick<
    AppStore,
    'sessionPhaseRuns' | 'agentKindOverride' | 'agentProviderOverride' | 'agentModelOverride'
  >;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly beforeOrdinal?: number;
};

export const earlierPicksOf = ({
  state,
  sessionId,
  workflowRunId,
  beforeOrdinal = Number.POSITIVE_INFINITY,
}: Params): ReadonlyArray<RoutedPick> =>
  (state.sessionPhaseRuns[sessionId] ?? [])
    .filter((agent) => agent.workflowRunId === workflowRunId && agent.ordinal < beforeOrdinal)
    .sort((left, right) => left.ordinal - right.ordinal)
    .map((agent) => ({
      role: KIND_TO_ROLE[
        classifyAgent({ agent, override: state.agentKindOverride[agent.id] ?? null })
      ],
      provider: state.agentProviderOverride[agent.id] ?? agent.providerOverride ?? null,
      model: state.agentModelOverride[agent.id] ?? agent.modelOverride ?? null,
    }));
