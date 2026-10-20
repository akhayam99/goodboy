import type { AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../store';
import type { OpenDrawer } from '../../store/slices/drawer/state';
import { runPlace } from '../workflows/runPlace';

type SpawnedTarget =
  | { readonly kind: 'run'; readonly runId: WorkflowRunId }
  | { readonly kind: 'run-agent'; readonly runId: WorkflowRunId; readonly agentId: AgentId }
  | { readonly kind: 'auto-root'; readonly agentId: AgentId }
  | { readonly kind: 'auto-child'; readonly agentId: AgentId };

type Params = {
  readonly sessionId: SessionId;
  readonly target: SpawnedTarget;
};

export const openSpawned = ({ sessionId, target }: Params): void => {
  const state = useAppStore.getState();
  const panel: OpenDrawer = { kind: 'spawned', sessionId, payload: null };
  switch (target.kind) {
    case 'run':
      state.navigate({ to: runPlace({ sessionId, runId: target.runId }), drawer: panel });
      return;
    case 'auto-root':
      state.navigate({ to: agentPlace({ sessionId, agentId: target.agentId }), drawer: panel });
      return;
    case 'run-agent':
      state.openDrawer({
        kind: 'run-step',
        sessionId,
        payload: { runId: target.runId, agentId: target.agentId, from: 'spawned' },
      });
      return;
    case 'auto-child':
      state.openDrawer({
        kind: 'auto-child',
        sessionId,
        payload: { agentId: target.agentId, from: 'spawned' },
      });
      return;
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
};
