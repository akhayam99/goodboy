import type {
  AgentId,
  ArtifactId,
  IsoDateTime,
  MountId,
  ProjectId,
  Session,
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionGroupKey,
  SessionId,
  SessionPrGroup,
  SessionSortKey,
  SessionStage,
  SessionViewPrefs,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import type {
  ArtifactFilter,
  GeneratedArtifactKind,
} from '../../../features/artifacts/artifactCollection';
import type { ResolveItemDraft } from '../../../features/resolve/resolveItemDraft';
import type { AgentKindRouting } from '../../../features/session/agent-kind';

export type { SetFn, GetFn } from '../../slice-types';

export type LensKind =
  | 'questions'
  | 'agents'
  | 'workflows'
  | 'review'
  | 'plans'
  | 'scripts'
  | 'terminal'
  | 'context'
  | 'goal'
  | 'decisions'
  | 'last_output_summary'
  | 'pr'
  | 'files'
  | 'explore'
  | 'linear'
  | 'gitlab_issues'
  | 'jira_issues'
  | 'github_issue'
  | 'slack_threads';

export const LENS_KINDS: ReadonlySet<LensKind> = new Set<LensKind>([
  'questions',
  'agents',
  'workflows',
  'review',
  'plans',
  'scripts',
  'terminal',
  'context',
  'goal',
  'decisions',
  'last_output_summary',
  'pr',
  'files',
  'explore',
  'linear',
  'gitlab_issues',
  'jira_issues',
  'github_issue',
  'slack_threads',
]);

export type DiffFocus =
  | { readonly kind: 'commit'; readonly sha: string; readonly path: string | null }
  | { readonly kind: 'working'; readonly path: string | null };

export type FocusedExternalTask = {
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
  readonly projectId: ProjectId | null;
};

export type ResolveQueueView = {
  readonly expandedThreadId: string | null;
  readonly order: ReadonlyArray<string>;
  readonly scrollTop: number;
  readonly detailScrollTop: number;
  readonly detailFocus: 'heading' | 'primary';
  readonly isDeferredShown: boolean;
  readonly isCompletedShown: boolean;
  readonly lastRouting: AgentKindRouting | null;
};

export type ResolvePublicationReturn = {
  readonly threadId: string;
  readonly reconcile: boolean;
  readonly requestId: number;
};

export type ResolveAgentReturn = {
  readonly agentId: AgentId;
  readonly threadId: string;
  readonly prNumber: number;
  readonly view: ResolveQueueView;
};

export type ResolveDiffReturn = {
  readonly threadId: string;
  readonly path: string | null;
  readonly line: number | null;
};

export const EMPTY_RESOLVE_QUEUE_VIEW: ResolveQueueView = {
  expandedThreadId: null,
  order: [],
  scrollTop: 0,
  detailScrollTop: 0,
  detailFocus: 'primary',
  isDeferredShown: false,
  isCompletedShown: false,
  lastRouting: null,
};

export type SessionStudio =
  | { readonly kind: 'workflow' }
  | { readonly kind: 'mr'; readonly mountId?: MountId }
  | { readonly kind: 'bitbucket'; readonly mountId?: MountId };

export const DEFAULT_PREFS: SessionViewPrefs = { sort: 'updatedAt', group: 'stage' };

export const VALID_SORTS = new Set<SessionSortKey>(['updatedAt', 'goal', 'createdAt']);
export const VALID_GROUPS = new Set<SessionGroupKey>(['none', 'stage', 'pr']);

export const STAGE_ORDER: Record<SessionStage, number> = {
  building: 0,
  running: 1,
  attention: 2,
  review: 3,
  done: 4,
};

export const PR_GROUP_ORDER: Record<SessionPrGroup, number> = {
  'not-open': 0,
  draft: 1,
  reviewable: 2,
  reviewed: 3,
  queued: 4,
  closed: 5,
  merged: 6,
};

export type WorkSurfacePosition = {
  readonly lens: LensKind | null;
  readonly agentId: AgentId | null;
  readonly studio: SessionStudio | null;
};

export type LensHistory = {
  readonly entries: ReadonlyArray<WorkSurfacePosition>;
  readonly index: number;
};

export type ArtifactCreationTarget = Readonly<{
  kind: GeneratedArtifactKind;
  note: string | null;
}>;

export type OpenArtifactCreationParams = Readonly<{
  sessionId: SessionId;
  kind: GeneratedArtifactKind;
  workflowRunId?: WorkflowRunId | null;
  note?: string | null;
}>;

export type CloseArtifactCreationParams = Readonly<{
  sessionId: SessionId;
}>;

export type SessionCreationKind = 'agent' | 'workflow' | 'branch';

export type SessionCreationId = string;

export type SessionCreation = {
  readonly id: SessionCreationId;
  readonly kind: SessionCreationKind;
  readonly label: string | null;
  readonly startedAt: IsoDateTime;
};

type SessionViewSliceState = {
  readonly scriptsLensScope: { readonly projectId: ProjectId } | null;
  readonly sessionViewPrefs: Readonly<Record<WorkspaceId, SessionViewPrefs>>;
  readonly activeLens: Readonly<Record<SessionId, LensKind | null>>;
  readonly lensHistory: Readonly<Record<SessionId, LensHistory>>;
  readonly focusedArtifactId: Readonly<Record<SessionId, ArtifactId | null>>;
  readonly artifactFilter: Readonly<Record<SessionId, ArtifactFilter>>;
  readonly artifactConversationAgentId: Readonly<Record<SessionId, AgentId | null>>;
  readonly artifactCreation: Readonly<Record<SessionId, ArtifactCreationTarget | null>>;
  readonly focusedGithubIssueNumber: Readonly<Record<SessionId, number | null>>;
  readonly focusedExternalTask: Readonly<Record<SessionId, FocusedExternalTask | null>>;
  readonly sessionStudio: Readonly<Record<SessionId, SessionStudio | null>>;
  readonly workflowExpand: Readonly<Record<SessionId, Readonly<Record<string, boolean>>>>;
  readonly focusedWorkflowRunId: Readonly<Record<SessionId, string | null>>;
  readonly diffFocus: Readonly<Record<SessionId, DiffFocus | null>>;
  readonly resolveQueueView: Readonly<Record<SessionId, ResolveQueueView>>;
  readonly resolveDiffReturn: Readonly<Record<SessionId, ResolveDiffReturn | null>>;
  readonly resolvePublicationReturn: Readonly<Record<SessionId, ResolvePublicationReturn | null>>;
  readonly resolveAgentReturn: Readonly<Record<SessionId, ResolveAgentReturn | null>>;
  readonly resolveItemDrafts: Readonly<
    Record<SessionId, Readonly<Record<string, ResolveItemDraft>>>
  >;
  readonly diffMountPath: Readonly<Record<SessionId, string | null>>;
  readonly terminalMountPath: Readonly<Record<SessionId, string | null>>;
  readonly sessionCreations: Readonly<Record<SessionId, ReadonlyArray<SessionCreation>>>;
};

type SessionViewSliceActions = {
  setScriptsLensScope(params: { readonly scope: { readonly projectId: ProjectId } | null }): void;
  getSessionViewPrefs(workspaceId: WorkspaceId): SessionViewPrefs;
  setSessionSort(workspaceId: WorkspaceId, sort: SessionSortKey): void;
  setSessionGroup(workspaceId: WorkspaceId, group: SessionGroupKey): void;
  setActiveLens(sessionId: SessionId, lens: LensKind | null): void;
  lensGo(sessionId: SessionId, delta: number): void;
  toggleWorkflowExpand(sessionId: SessionId, runId: string, defaultExpanded: boolean): void;
  setFocusedWorkflowRun(sessionId: SessionId, runId: string | null): void;
  setFocusedArtifactId(sessionId: SessionId, artifactId: ArtifactId | null): void;
  setArtifactFilter(params: {
    readonly sessionId: SessionId;
    readonly filter: ArtifactFilter;
  }): void;
  openArtifactConversation(params: {
    readonly sessionId: SessionId;
    readonly agentId: AgentId;
  }): void;
  closeArtifactConversation(params: {
    readonly sessionId: SessionId;
    readonly agentId: AgentId;
  }): void;
  openArtifactCreation(params: OpenArtifactCreationParams): void;
  closeArtifactCreation(params: CloseArtifactCreationParams): void;
  setFocusedGithubIssueNumber(sessionId: SessionId, issueNumber: number | null): void;
  openExternalTaskLens(sessionId: SessionId, task: SessionExternalTask): void;
  setSessionStudio(sessionId: SessionId, studio: SessionStudio | null): void;
  setDiffFocus(sessionId: SessionId, focus: DiffFocus | null): void;
  setResolveQueueView(params: {
    readonly sessionId: SessionId;
    readonly patch: Partial<ResolveQueueView>;
  }): void;
  openResolveDiff(params: {
    readonly sessionId: SessionId;
    readonly threadId: string;
    readonly sha: string;
    readonly path: string | null;
    readonly line: number | null;
    readonly order: ReadonlyArray<string>;
    readonly scrollTop: number;
  }): void;
  returnFromResolveDiff(params: { readonly sessionId: SessionId }): void;
  openResolvePublication(params: {
    readonly sessionId: SessionId;
    readonly threadId: string;
    readonly reconcile: boolean;
  }): void;
  returnFromResolvePublication(params: { readonly sessionId: SessionId }): void;
  openResolveAgent(params: {
    readonly sessionId: SessionId;
    readonly agentId: AgentId;
    readonly threadId: string;
    readonly prNumber: number;
  }): void;
  returnFromResolveAgent(params: { readonly sessionId: SessionId }): void;
  setResolveItemDraft(params: {
    readonly sessionId: SessionId;
    readonly threadId: string;
    readonly patch: Partial<ResolveItemDraft>;
  }): void;
  openDiffLens(sessionId: SessionId, focus: DiffFocus | null): void;
  openMountDiff(sessionId: SessionId, worktreePath: string): void;
  openMountTerminal(sessionId: SessionId, worktreePath: string): void;
  beginSessionCreation(
    sessionId: SessionId,
    creation: { readonly kind: SessionCreationKind; readonly label?: string | null },
  ): SessionCreationId;
  endSessionCreation(sessionId: SessionId, creationId: SessionCreationId): void;
};

export type SessionViewSlice = SessionViewSliceState & SessionViewSliceActions;

export type GroupedSessions = {
  readonly key: string;
  readonly sessions: ReadonlyArray<Session>;
};
