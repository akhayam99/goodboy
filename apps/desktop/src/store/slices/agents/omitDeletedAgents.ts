import type { AgentId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly agentIds: ReadonlySet<AgentId>;
};

type OmitParams<T> = {
  readonly record: Readonly<Record<string, T>> | undefined;
  readonly ids: ReadonlySet<string>;
};

const omit = <T>({ record, ids }: OmitParams<T>): Record<string, T> =>
  Object.fromEntries(Object.entries(record ?? {}).filter(([id]) => !ids.has(id)));

export const omitDeletedAgents = ({ state, sessionId, agentIds }: Params) => {
  const selected = state.selectedAgentId[sessionId];
  const isSelectedDeleted = selected != null && agentIds.has(selected);
  return {
    selectedAgentId: isSelectedDeleted
      ? omit({ record: state.selectedAgentId, ids: new Set([sessionId]) })
      : state.selectedAgentId,
    agentTurnState: omit({ record: state.agentTurnState, ids: agentIds }),
    transcripts: omit({ record: state.transcripts, ids: agentIds }),
    agentDraft: omit({ record: state.agentDraft, ids: agentIds }),
    agentTab: omit({ record: state.agentTab, ids: agentIds }),
    agentAttachments: omit({ record: state.agentAttachments, ids: agentIds }),
    agentQueue: omit({ record: state.agentQueue, ids: agentIds }),
    agentRunHistory: omit({ record: state.agentRunHistory, ids: agentIds }),
    runRouting: omit({ record: state.runRouting, ids: agentIds }),
    agentModelOverride: omit({ record: state.agentModelOverride, ids: agentIds }),
    agentProviderOverride: omit({ record: state.agentProviderOverride, ids: agentIds }),
    agentEffortOverride: omit({ record: state.agentEffortOverride, ids: agentIds }),
    agentKindOverride: omit({ record: state.agentKindOverride, ids: agentIds }),
    agentTurnDestination: omit({ record: state.agentTurnDestination, ids: agentIds }),
    workflowContinueAttempts: omit({ record: state.workflowContinueAttempts, ids: agentIds }),
    clusterStepStartAttempts: omit({ record: state.clusterStepStartAttempts, ids: agentIds }),
  };
};
