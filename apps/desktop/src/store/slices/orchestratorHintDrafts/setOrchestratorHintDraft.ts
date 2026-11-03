import type { WorkflowRunId } from '@goodboy/types';
import type { SetFn } from '../../slice-types';

type FactoryParams = {
  readonly set: SetFn;
};

export type Params = {
  readonly workflowRunId: WorkflowRunId;
  readonly text: string;
};

export const setOrchestratorHintDraft = ({ set }: FactoryParams) => {
  return ({ workflowRunId, text }: Params): void => {
    set((state) => {
      if (text === '') {
        if (!(workflowRunId in state.orchestratorHintDrafts)) {
          return state;
        }
        const next = { ...state.orchestratorHintDrafts };
        delete next[workflowRunId];
        return { orchestratorHintDrafts: next };
      }
      return { orchestratorHintDrafts: { ...state.orchestratorHintDrafts, [workflowRunId]: text } };
    });
  };
};
