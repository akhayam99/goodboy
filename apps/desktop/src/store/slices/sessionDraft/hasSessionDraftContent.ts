import type { SessionDraft } from './state';

type Params = {
  readonly draft: SessionDraft;
};

export const hasSessionDraftContent = ({ draft }: Params): boolean =>
  draft.runText.trim() !== '' ||
  draft.issueQuery.trim() !== '' ||
  draft.pickedIssues.length > 0 ||
  draft.focusedIssueKey !== null ||
  draft.workflowGoal.trim() !== '' ||
  draft.workflowId !== null ||
  draft.agentPrompt.trim() !== '' ||
  draft.autoGoal.trim() !== '';
