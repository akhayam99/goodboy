import type { WorkflowDraft } from './types';

type Params = {
  readonly draft: WorkflowDraft;
};

export const hasWorkflowDraftContent = ({ draft }: Params): boolean =>
  [draft.name, draft.description, draft.entryCheck, draft.stopRule].some(
    (text) => text.trim().length > 0,
  ) ||
  draft.thenSuggestId !== null ||
  draft.isOrderKept ||
  draft.steps.length > 0;
