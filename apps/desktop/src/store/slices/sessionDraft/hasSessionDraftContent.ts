import type { SessionDraft } from './state';

type Params = {
  readonly draft: SessionDraft;
};

export const hasSessionDraftContent = ({ draft }: Params): boolean =>
  draft.issueQuery.trim() !== '' ||
  draft.issueKey !== null ||
  draft.pickedIssue !== null ||
  draft.workflowGoal.trim() !== '' ||
  draft.workflowId !== null ||
  draft.agentPrompt.trim() !== '';
