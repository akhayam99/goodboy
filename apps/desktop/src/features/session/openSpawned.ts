import type { AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../store';
import { runPlace } from '../workflows/runPlace';

type SpawnedTarget =
  | { readonly kind: 'run'; readonly runId: WorkflowRunId }
  | { readonly kind: 'agent'; readonly agentId: AgentId };

type Params = {
  readonly sessionId: SessionId;
  readonly target: SpawnedTarget;
};

export const openSpawned = ({ sessionId, target }: Params): void => {
  const state = useAppStore.getState();
  switch (target.kind) {
    case 'run':
      state.navigate({ to: runPlace({ sessionId, runId: target.runId }) });
      return;
    case 'agent':
      state.navigate({ to: agentPlace({ sessionId, agentId: target.agentId }) });
      return;
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
};
