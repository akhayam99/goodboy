import type { WorkflowDraftKey, WorkflowBuilderDraft } from './types';

export type WorkflowDraftsState = {
  readonly workflowDrafts: Readonly<Record<WorkflowDraftKey, WorkflowBuilderDraft | undefined>>;
};

export const workflowDraftsInitialState: WorkflowDraftsState = {
  workflowDrafts: {},
};
