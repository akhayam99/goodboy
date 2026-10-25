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
  FocusedExternalTask,
  ResolveQueueView,
} from './types';
import type { ResolveItemDraft } from '../../../features/resolve/resolveItemDraft';
import type { AgentPane, BranchTab } from '../navigation/types';
import type { ArtifactFilter } from '../../../features/artifacts/artifactCollection';

export type SessionViewState = {
  readonly selectedAgentId: Readonly<Record<SessionId, AgentId | null>>;
  readonly scriptsLensScope: { readonly projectId: ProjectId } | null;
  readonly sessionViewPrefs: Readonly<Record<WorkspaceId, SessionViewPrefs>>;
  readonly activeLens: Readonly<Record<SessionId, LensKind | null>>;
  readonly focusedWorkflowRunId: Readonly<Record<SessionId, string | null>>;
  readonly diffFocus: Readonly<Record<SessionId, DiffFocus | null>>;
  readonly diffMountPath: Readonly<Record<SessionId, string | null>>;
  readonly branchTab: Readonly<Record<SessionId, BranchTab>>;
  readonly dismissedCheckProposals: Readonly<Record<SessionId, ReadonlyArray<AgentId>>>;
  readonly sessionDismissedNextSteps: Readonly<Record<SessionId, ReadonlySet<string>>>;
  readonly branchThreadId: Readonly<Record<SessionId, string | null>>;
  readonly resolveQueueView: Readonly<Record<SessionId, ResolveQueueView>>;
  readonly resolveItemDrafts: Readonly<
    Record<SessionId, Readonly<Record<string, ResolveItemDraft>>>
  >;
  readonly sessionCreations: Readonly<Record<SessionId, ReadonlyArray<SessionCreation>>>;
  readonly sessionGroupExpanded: Readonly<Record<string, boolean>>;
  readonly focusedArtifactId: Readonly<Record<SessionId, ArtifactId | null>>;
  readonly artifactFilter: Readonly<Record<SessionId, ArtifactFilter>>;
  readonly artifactConversationAgentId: Readonly<Record<SessionId, AgentId | null>>;
  readonly awaitedArtifactAgentId: Readonly<Record<SessionId, AgentId | null>>;
  readonly focusedGithubIssueNumber: Readonly<Record<SessionId, number | null>>;
  readonly focusedExternalTask: Readonly<Record<SessionId, FocusedExternalTask | null>>;
  readonly agentPane: Readonly<Record<SessionId, AgentPane | null>>;
  readonly agentTab: Readonly<Record<AgentId, AgentPane>>;
  readonly exploreExpanded: Readonly<
    Record<SessionId, Readonly<Record<string, Readonly<Record<string, boolean>>>>>
  >;
  readonly exploreMountPath: Readonly<Record<SessionId, string | null>>;
};
