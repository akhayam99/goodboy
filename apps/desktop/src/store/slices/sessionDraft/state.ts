import type { WorkflowId, WorkspaceId } from '@goodboy/types';
import type { IssueCandidate } from '../../../features/integrations/fetchIssueCandidates';

export type StartChoice = 'task' | 'workflow' | 'scout';

export type SessionDraft = {
  readonly choice: StartChoice | null;
  readonly issueQuery: string;
  readonly issueKey: string | null;
  readonly pickedIssue: IssueCandidate | null;
  readonly workflowGoal: string;
  readonly workflowId: WorkflowId | null;
  readonly agentPrompt: string;
};

export const EMPTY_SESSION_DRAFT: SessionDraft = {
  choice: null,
  issueQuery: '',
  issueKey: null,
  pickedIssue: null,
  workflowGoal: '',
  workflowId: null,
  agentPrompt: '',
};

export type SessionDraftState = {
  readonly sessionDrafts: Readonly<Record<WorkspaceId, SessionDraft>>;
  readonly openSessionDraftWorkspaceId: WorkspaceId | null;
};

export const initialSessionDraftState: SessionDraftState = {
  sessionDrafts: {},
  openSessionDraftWorkspaceId: null,
};
