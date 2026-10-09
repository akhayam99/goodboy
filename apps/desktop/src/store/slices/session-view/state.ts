import type {
  SessionId,
  AgentId,
  ProjectId,
  WorkspaceId,
  SessionViewPrefs,
  ArtifactId,
} from '@goodboy/types';
import type {
  LensKind,
  DiffFocus,
  SessionCreation,
  SessionStudio,
  ArtifactCreationTarget,
  FocusedExternalTask,
} from './types';
import type { AgentPane, BranchTab } from '../navigation/types';
import type { ArtifactFilter } from '../../../features/artifacts/artifactCollection';

export type SessionViewState = {
  readonly selectedAgentId: Readonly<Record<SessionId, AgentId | null>>;
  readonly scriptsLensScope: { readonly projectId: ProjectId } | null;
  readonly sessionViewPrefs: Readonly<Record<WorkspaceId, SessionViewPrefs>>;
  readonly activeLens: Readonly<Record<SessionId, LensKind | null>>;
  readonly workflowExpand: Readonly<Record<SessionId, Readonly<Record<string, boolean>>>>;
  readonly focusedWorkflowRunId: Readonly<Record<SessionId, string | null>>;
  readonly diffFocus: Readonly<Record<SessionId, DiffFocus | null>>;
  readonly diffMountPath: Readonly<Record<SessionId, string | null>>;
  readonly branchTab: Readonly<Record<SessionId, BranchTab>>;
  readonly sessionPagesFolded: Readonly<Record<SessionId, boolean>>;
  readonly branchThreadId: Readonly<Record<SessionId, string | null>>;
  readonly terminalMountPath: Readonly<Record<SessionId, string | null>>;
  readonly sessionCreations: Readonly<Record<SessionId, ReadonlyArray<SessionCreation>>>;
  readonly sessionGroupExpanded: Readonly<Record<string, boolean>>;
  readonly sessionStudio: Readonly<Record<SessionId, SessionStudio | null>>;
  readonly focusedArtifactId: Readonly<Record<SessionId, ArtifactId | null>>;
  readonly artifactFilter: Readonly<Record<SessionId, ArtifactFilter>>;
  readonly artifactConversationAgentId: Readonly<Record<SessionId, AgentId | null>>;
  readonly artifactCreation: Readonly<Record<SessionId, ArtifactCreationTarget | null>>;
  readonly focusedGithubIssueNumber: Readonly<Record<SessionId, number | null>>;
  readonly focusedExternalTask: Readonly<Record<SessionId, FocusedExternalTask | null>>;
  readonly agentPane: Readonly<Record<SessionId, AgentPane | null>>;
  readonly agentTab: Readonly<Record<AgentId, AgentPane>>;
};
