import type {
  ProjectId,
  RunRouteCloseness,
  SessionId,
  WorkflowAutonomy,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import type { IssueCandidate } from '../../../features/integrations/fetchIssueCandidates';
import type { AgentKind, AgentKindRouting } from '../../../features/session/agent-kind';

export type StartKind = 'workflow' | 'agent' | 'auto';

export type StartShape = 'orchestrated' | 'preset' | 'agent' | 'autoAgent';

export type SessionDraft = {
  readonly startKind: StartKind | null;
  readonly startShape: StartShape | null;
  readonly hasChosenStart: boolean;
  readonly presetCloseness: RunRouteCloseness;
  readonly autonomy: WorkflowAutonomy;
  readonly issueQuery: string;
  readonly pickedIssues: ReadonlyArray<IssueCandidate>;
  readonly focusedIssueKey: string | null;
  readonly hasPickedStep: boolean;
  readonly workflowGoal: string;
  readonly workflowId: WorkflowId | null;
  readonly agentPrompt: string;
  readonly projectIds: ReadonlyArray<ProjectId>;
  readonly agentKind: AgentKind;
  readonly agentRouting: AgentKindRouting | null;
  readonly autoGoal: string;
  readonly autoRouting: AgentKindRouting | null;
  readonly isStarting: boolean;
  readonly startError: string | null;
};

export const EMPTY_SESSION_DRAFT: SessionDraft = {
  startKind: null,
  startShape: null,
  hasChosenStart: false,
  presetCloseness: 'adapt',
  autonomy: 'step',
  issueQuery: '',
  pickedIssues: [],
  focusedIssueKey: null,
  hasPickedStep: false,
  workflowGoal: '',
  workflowId: null,
  agentPrompt: '',
  projectIds: [],
  agentKind: 'scout',
  agentRouting: null,
  autoGoal: '',
  autoRouting: null,
  isStarting: false,
  startError: null,
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
