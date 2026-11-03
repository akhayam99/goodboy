import type { WorkflowRunId } from '@goodboy/types';

export type OrchestratorHintDraftsState = {
  readonly orchestratorHintDrafts: Readonly<Record<WorkflowRunId, string>>;
};

export const orchestratorHintDraftsInitialState: OrchestratorHintDraftsState = {
  orchestratorHintDrafts: {},
};
