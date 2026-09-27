import type { ProjectId, SessionId, WorkflowId, WorkspaceId } from '@goodboy/types';
import type { IssueCandidate } from '../../../features/integrations/fetchIssueCandidates';
import type { AgentKind, AgentKindRouting } from '../../../features/session/agent-kind';
import type { Mode } from '../workflowDrafts/types';

export type StartChoice = 'task' | 'workflow' | 'scout';

export type SessionDraft = {
  readonly choice: StartChoice | null;
  readonly issueQuery: string;
  readonly issueKey: string | null;
  readonly pickedIssue: IssueCandidate | null;
  readonly workflowGoal: string;
  readonly workflowId: WorkflowId | null;
  readonly workflowMode: Mode | null;
  readonly agentPrompt: string;
  readonly projectId: ProjectId | null;
  readonly agentKind: AgentKind;
  readonly agentRouting: AgentKindRouting | null;
};

export const EMPTY_SESSION_DRAFT: SessionDraft = {
  choice: null,
  issueQuery: '',
  issueKey: null,
  pickedIssue: null,
  workflowGoal: '',
  workflowId: null,
  workflowMode: null,
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
