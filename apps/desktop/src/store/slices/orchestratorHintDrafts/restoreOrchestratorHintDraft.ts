import type { WorkflowRunId } from '@goodboy/types';
import type { SetFn } from '../../slice-types';

type FactoryParams = {
  readonly set: SetFn;
};

export type Params = {
  readonly workflowRunId: WorkflowRunId;
  readonly text: string;
};

export const restoreOrchestratorHintDraft = ({ set }: FactoryParams) => {
  return ({ workflowRunId, text }: Params): void => {
    set((state) => {
      if (text === '' || workflowRunId in state.orchestratorHintDrafts) {
        return state;
      }
      return { orchestratorHintDrafts: { ...state.orchestratorHintDrafts, [workflowRunId]: text } };
    });
  };
};
