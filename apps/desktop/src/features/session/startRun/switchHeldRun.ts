import type { AgentId, SessionId, WorkflowId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { changeRunRoute } from './changeRunRoute';
import { endHeldRun } from './endHeldRun';
import { OldRunLeftError } from './OldRunLeftError';
import { RUN_ROUTE_COPY } from './runRouteCopy';
import { parseRunRoutes, runRoutesKey } from './runRoutesSetting';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly workflowId: WorkflowId;
};

export const switchHeldRun = async ({ sessionId, agentId, workflowId }: Params): Promise<void> => {
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
  try {
    await endHeldRun({ sessionId, agentId });
  } catch (failure) {
    throw new OldRunLeftError({
      message: RUN_ROUTE_COPY.notEnded,
      failure,
      endOldRun: () => endHeldRun({ sessionId, agentId }),
    });
  }
};
