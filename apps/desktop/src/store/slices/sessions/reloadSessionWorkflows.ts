import type { SessionId } from '@goodboy/types';
import { invokeWorkflowsForSession } from '../../../features/workflows/workflows';
import type { SetFn } from './types';

type FactoryParams = {
  readonly set: SetFn;
};

export type ReloadSessionWorkflowsParams = {
  readonly sessionId: SessionId;
};

export const reloadSessionWorkflows = ({ set }: FactoryParams) => {
  return async ({ sessionId }: ReloadSessionWorkflowsParams): Promise<void> => {
    const fresh = await invokeWorkflowsForSession(sessionId);
    set((state) => {
      const freshIds = new Set(fresh.map((workflow) => workflow.id));
      const retained = (state.sessionWorkflows[sessionId] ?? []).filter(
        (workflow) => !freshIds.has(workflow.id),
      );
      return {
        sessionWorkflows: { ...state.sessionWorkflows, [sessionId]: [...retained, ...fresh] },
      };
    });
  };
};
