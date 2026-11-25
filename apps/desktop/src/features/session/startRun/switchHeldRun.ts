import type { AgentId, SessionId, WorkflowId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { changeRunRoute } from './changeRunRoute';
import { endHeldRun } from './endHeldRun';
import { OldRunLeftError } from './OldRunLeftError';
import { RUN_ROUTE_COPY } from './runRouteCopy';
import { REPLACED_HELD_RUNS } from './replacedHeldRuns';
import { parseRunRoutes, runRoutesKey } from './runRoutesSetting';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly workflowId: WorkflowId;
};

type EndParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const endReplacedRun = async ({ sessionId, agentId }: EndParams): Promise<void> => {
  try {
    await endHeldRun({ sessionId, agentId });
    REPLACED_HELD_RUNS.delete(agentId);
  } catch (failure) {
    throw new OldRunLeftError({
      message: RUN_ROUTE_COPY.notEnded,
      failure,
      endOldRun: async () => {
        await endHeldRun({ sessionId, agentId });
        REPLACED_HELD_RUNS.delete(agentId);
      },
    });
  }
};

export const switchHeldRun = async ({ sessionId, agentId, workflowId }: Params): Promise<void> => {
  if (REPLACED_HELD_RUNS.has(agentId)) {
    await endReplacedRun({ sessionId, agentId });
    return;
  }
  const key = runRoutesKey({ sessionId });
  await useAppStore.getState().loadSetting(key);
  const closeness =
    parseRunRoutes({ raw: useAppStore.getState().settings[key] })[agentId]?.closeness ?? 'adapt';
  const change = await changeRunRoute({
    target: { kind: 'lead', sessionId, agentId },
    choice: { shape: 'lead', presetId: workflowId, closeness },
  });
  if (change !== 'second-run') {
    return;
  }
  REPLACED_HELD_RUNS.add(agentId);
  await endReplacedRun({ sessionId, agentId });
};
