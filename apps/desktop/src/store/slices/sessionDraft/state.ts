import type { ProjectId, SessionId, WorkflowId, WorkspaceId } from '@goodboy/types';
import type { IssueCandidate } from '../../../features/integrations/fetchIssueCandidates';
import type { AgentKind, AgentKindRouting } from '../../../features/session/agent-kind';

export type StartChoice = 'task' | 'workflow' | 'scout';

export type SessionDraft = {
  readonly choice: StartChoice | null;
  readonly issueQuery: string;
  readonly pickedIssues: ReadonlyArray<IssueCandidate>;
  readonly focusedIssueKey: string | null;
  readonly hasPickedStep: boolean;
  readonly workflowGoal: string;
  readonly workflowId: WorkflowId | null;
  readonly agentPrompt: string;
  readonly projectId: ProjectId | null;
  readonly agentKind: AgentKind;
  readonly agentRouting: AgentKindRouting | null;
};

export const EMPTY_SESSION_DRAFT: SessionDraft = {
  choice: null,
  issueQuery: '',
  pickedIssues: [],
  focusedIssueKey: null,
  hasPickedStep: false,
  workflowGoal: '',
  workflowId: null,
  agentPrompt: '',
  projectId: null,
  agentKind: 'scout',
  agentRouting: null,
};

export type SessionDraftState = {
  readonly sessionDrafts: Readonly<Record<WorkspaceId, SessionDraft>>;
  readonly openSessionDraftWorkspaceId: WorkspaceId | null;
  readonly goodboyNamedSessionId: SessionId | null;
};

export const initialSessionDraftState: SessionDraftState = {
  sessionDrafts: {},
  openSessionDraftWorkspaceId: null,
  goodboyNamedSessionId: null,
};
