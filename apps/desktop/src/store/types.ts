import type { FileConflict } from '@goodboy/core';
import type { Notification, TelemetrySummary } from '@goodboy/db';
import type {
  Agent,
  AgentId,
  BudgetAlert,
  BudgetRule,
  ContextSlot,
  ContextSlotHistoryEntry,
  DiffComment,
  GhTokenStatus,
  GoalAttachment,
  IsoDateTime,
  LinkedIssue,
  Message,
  OpenQuestion,
  OpenQuestionId,
  OverrideSettings,
  PendingResolution,
  PlanConsumption,
  PlanId,
  PlanWithCount,
  PrDetail,
  PrReviewDraft,
  ProviderCredential,
  ProviderId,
  ProviderRunId,
  PullRequestState,
  Session,
  SessionBudget,
  SessionExternalTask,
  SessionId,
  SessionViewPrefs,
  Skill,
  StepDef,
  TelemetryRecord,
  TurnEvent,
  TurnState,
  Workflow,
  WorkflowRunId,
  Workspace,
  WorkspaceId,
  WorkspaceIntegration,
  WorkspaceScript,
  WorkspaceScriptId,
} from '@goodboy/types';
import type { AgentKind } from '../features/session/agent-kind';
import type { ResolverState } from '../features/workspace/components/WorkspacesSidebar/lib';
import type { GitlabMergeRequest } from '../features/integrations/gitlab/client';
import type {
  ProviderAuthResults,
  ProviderInfo,
  ProviderStatus,
} from '../features/providers/providers';
import type { ScriptRunRecord } from '../features/scripts/scripts';
import type { DetectedEditor } from '../shared/lib/editor';
import type { TerminalTab, TerminalTabId } from '../shared/types/terminal';
import type { DraftAttachment } from './slices/agents/setAgentAttachments';
import type { AgentQueuedTurn } from './slices/agents/setAgentQueue';
import type { ProviderSpendEntry } from './slices/budget';
import type { ProviderLifecycleMap } from './slices/providers';
import type { ReviewPrsState } from './slices/review-prs/types';
import type { LensHistory, LensKind, SessionStudio } from './slices/session-view';
import type { PanelSection } from './slices/sidebar/types';
import type { UpdaterState } from './slices/updater/state';
import type { WorkflowBuilderDraft } from './slices/workflowDrafts/types';

export type ResolverThreadOutcome =
  | { readonly kind: 'resolved'; readonly commitSha: string }
  | { readonly kind: 'wontfix'; readonly reason: string }
  | { readonly kind: 'analyzed' };

export type BootPhase =
  | 'pending'
  | 'migrating'
  | 'loading-settings'
  | 'detecting-cli'
  | 'loading-workspaces'
  | 'restoring-session'
  | 'ready'
  | 'error';

export type SystemAlertKind = 'audit-retry-corrupt' | 'audit-retry-exhausted' | 'context-soft-cap';

export type SystemAlert = {
  readonly id: string;
  readonly kind: SystemAlertKind;
  readonly message: string;
  readonly createdAt: string;
};

export type SessionNudge =
  | {
      readonly kind: 'plan-ready';
      readonly id: string;
      readonly agentId: AgentId;
      readonly planId: PlanId | null;
      readonly planTitle: string;
    }
  | {
      readonly kind: 'handoff-suggested';
      readonly id: string;
      readonly agentId: AgentId;
      readonly targetKind: AgentKind;
      readonly reason: string;
      readonly planId: PlanId | null;
    }
  | {
      readonly kind: 'scout-fanout-suggested';
      readonly id: string;
      readonly agentId: AgentId;
      readonly workspaceId: WorkspaceId;
      readonly areaCount: number;
    };

export type SessionLoadingFlags = {
  readonly agents: boolean;
  readonly transcript: boolean;
  readonly telemetry: boolean;
  readonly slots: boolean;
  readonly plans: boolean;
  readonly summary: boolean;
};

export type SessionGitlabMrState = {
  readonly mr: GitlabMergeRequest | null;
  readonly fetchedAt: IsoDateTime | null;
  readonly loading: boolean;
  readonly error: string | null;
};

export type SessionGithubState = {
  readonly pr: PullRequestState | null;
  readonly linkedIssues: ReadonlyArray<LinkedIssue>;
  readonly fetchedAt: IsoDateTime | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly detail: PrDetail | null;
  readonly detailFetchedAt: IsoDateTime | null;
  readonly detailLoading: boolean;
  readonly detailError: string | null;
};

export type SummarizerSessionStatus = {
  readonly status: 'idle' | 'running' | 'error';
  readonly lastUpdate: IsoDateTime | null;
  readonly error: string | null;
  readonly lastUsage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly estimatedCostUsd: number;
  } | null;
  readonly lastAttempt: {
    readonly turnInput: string;
    readonly turnOutput: string;
  } | null;
};

export type AppState = UpdaterState & {
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly workspaceIntegrations: Readonly<
    Record<WorkspaceId, ReadonlyArray<WorkspaceIntegration>>
  >;
  readonly sessionExternalTasks: Readonly<Record<SessionId, ReadonlyArray<SessionExternalTask>>>;
  readonly currentWorkspaceId: WorkspaceId | null;
  readonly windowPresence: Readonly<Record<string, WorkspaceId | null>>;
  readonly sessions: ReadonlyArray<Session>;
  readonly archivedSessions: Readonly<Record<WorkspaceId, ReadonlyArray<Session>>>;
  readonly currentSessionId: SessionId | null;
  readonly settings: Readonly<Record<string, string>>;
  readonly sessionSummary: TelemetrySummary | null;
  readonly providerStatus: ProviderStatus | null;
  readonly cursorStatus: ProviderStatus | null;
  readonly codexStatus: ProviderStatus | null;
  readonly geminiStatus: ProviderStatus | null;
  readonly authResults: ProviderAuthResults | null;
  readonly providers: ReadonlyArray<ProviderInfo>;
  readonly providerLifecycle: ProviderLifecycleMap;
  readonly providerCredentials: ReadonlyArray<ProviderCredential>;
  readonly hydrated: boolean;
  readonly bootPhase: BootPhase;
  readonly error: string | null;
  readonly transcripts: Readonly<Record<string, ReadonlyArray<TurnEvent>>>;
  readonly messages: Readonly<Record<string, ReadonlyArray<Message>>>;
  readonly sessionWorktrees: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly sessionBranches: Readonly<Record<string, string>>;
  readonly sessionTelemetry: Readonly<Record<string, ReadonlyArray<TelemetryRecord>>>;
  readonly workspaceSummary: TelemetrySummary | null;
  readonly sessionSlots: Readonly<Record<string, ReadonlyArray<ContextSlot>>>;
  readonly slotHistory: Readonly<
    Record<string, Readonly<Record<string, ReadonlyArray<ContextSlotHistoryEntry>>>>
  >;
  readonly summarizerStatus: Readonly<Record<string, SummarizerSessionStatus>>;
  readonly budgetRules: ReadonlyArray<BudgetRule>;
  readonly sessionBudgets: Readonly<Record<SessionId, SessionBudget>>;
  readonly providerSpendBreakdown: ReadonlyArray<ProviderSpendEntry>;
  readonly budgetAlerts: ReadonlyArray<BudgetAlert>;
  readonly systemAlerts: ReadonlyArray<SystemAlert>;
  readonly skills: Readonly<Record<WorkspaceId, ReadonlyArray<Skill>>>;
  readonly workspaceScripts: Readonly<Record<WorkspaceId, ReadonlyArray<WorkspaceScript>>>;
  readonly scriptRuns: Readonly<
    Record<SessionId, Readonly<Record<WorkspaceScriptId, ScriptRunRecord>>>
  >;
  readonly phaseTemplates: Readonly<Record<WorkspaceId, ReadonlyArray<Workflow>>>;
  readonly stepLibrary: Readonly<Record<WorkspaceId, ReadonlyArray<StepDef>>>;
  readonly sessionWorkflows: Readonly<Record<SessionId, ReadonlyArray<Workflow>>>;
  readonly sessionPhaseRuns: Readonly<Record<SessionId, ReadonlyArray<Agent>>>;
  readonly selectedAgentId: Readonly<Record<SessionId, AgentId | null>>;
  readonly agentRunHistory: Readonly<Record<AgentId, ReadonlyArray<ProviderRunId>>>;
  readonly agentTurnState: Readonly<Record<AgentId, TurnState>>;
  readonly sessionMergeConflicts: Readonly<Record<SessionId, ReadonlyArray<FileConflict>>>;
  readonly unknownPayloadCounts: Readonly<Record<string, number>>;
  readonly detectedEditors: ReadonlyArray<DetectedEditor>;
  readonly workspaceOverrides: Readonly<Record<WorkspaceId, OverrideSettings>>;
  readonly sessionOverrides: Readonly<Record<SessionId, OverrideSettings>>;
  readonly sidebarWorkspaceSearch: string;
  readonly sidebarSessionSearch: string;
  readonly unreadWorkspaceIds: ReadonlySet<WorkspaceId>;
  readonly sidebarStateFilter: ReadonlyArray<TurnState['kind']>;
  readonly sidebarProviderFilter: ReadonlyArray<ProviderId>;
  readonly sessionPanelExpanded: Readonly<
    Record<SessionId, Partial<Record<PanelSection, boolean>>>
  >;
  readonly githubStatus: GhTokenStatus | null;
  readonly sessionGithub: Readonly<Record<SessionId, SessionGithubState>>;
  readonly sessionGitlabMr: Readonly<Record<SessionId, SessionGitlabMrState>>;
  readonly reviewPrs: Readonly<Record<WorkspaceId, ReviewPrsState>>;
  readonly reviewDrafts: Readonly<Record<SessionId, ReadonlyArray<PrReviewDraft>>>;
  readonly sessionPendingResolutions: Readonly<Record<SessionId, ReadonlyArray<PendingResolution>>>;
  readonly volatilePermissionAllows: ReadonlySet<string>;
  readonly agentModelOverride: Readonly<Record<AgentId, string>>;
  readonly agentProviderOverride: Readonly<Record<AgentId, ProviderId>>;
  readonly agentEffortOverride: Readonly<Record<AgentId, string>>;
  readonly agentKindOverride: Readonly<Record<AgentId, AgentKind>>;
  readonly pendingResolverKickoff: Readonly<Record<AgentId, string>>;
  readonly resolverState: Readonly<Record<AgentId, ResolverState>>;
  readonly resolverThreadOutcomes: Readonly<
    Record<AgentId, Readonly<Record<string, ResolverThreadOutcome>>>
  >;
  readonly agentDraft: Readonly<Record<AgentId, string>>;
  readonly workflowDrafts: Readonly<Record<SessionId, WorkflowBuilderDraft | undefined>>;
  readonly agentAttachments: Readonly<Record<AgentId, ReadonlyArray<DraftAttachment>>>;
  readonly agentQueue: Readonly<Record<AgentId, ReadonlyArray<AgentQueuedTurn>>>;
  readonly diffComments: Readonly<Record<string, ReadonlyArray<DiffComment>>>;
  readonly sessionAttachments: Readonly<Record<SessionId, ReadonlyArray<GoalAttachment>>>;
  readonly workflowRunAttachments: Readonly<Record<WorkflowRunId, ReadonlyArray<GoalAttachment>>>;
  readonly notifications: ReadonlyArray<Notification>;
  readonly sessionPlans: Readonly<Record<SessionId, ReadonlyArray<PlanWithCount>>>;
  readonly planConsumptions: Readonly<Record<PlanId, ReadonlyArray<PlanConsumption>>>;
  readonly sessionOpenQuestions: Readonly<Record<SessionId, ReadonlyArray<OpenQuestion>>>;
  readonly sessionAnsweredQuestions: Readonly<Record<SessionId, ReadonlyArray<OpenQuestion>>>;
  readonly openQuestionScrollTarget: {
    readonly agentId: AgentId;
    readonly questionId: OpenQuestionId;
  } | null;
  readonly sessionNudges: Readonly<Record<SessionId, SessionNudge | null>>;
  readonly sessionLoading: Readonly<Record<SessionId, SessionLoadingFlags>>;
  readonly boardReady: boolean;
  readonly sessionsSidebarCollapsed: boolean;
  readonly sessionViewPrefs: Readonly<Record<WorkspaceId, SessionViewPrefs>>;
  readonly activeLens: Readonly<Record<SessionId, LensKind | null>>;
  readonly lensHistory: Readonly<Record<SessionId, LensHistory>>;
  readonly workflowExpand: Readonly<Record<SessionId, Readonly<Record<string, boolean>>>>;
  readonly focusedWorkflowRunId: Readonly<Record<SessionId, string | null>>;
  readonly sessionStudio: Readonly<Record<SessionId, SessionStudio | null>>;
  readonly focusedPlanId: Readonly<Record<SessionId, PlanId | null>>;
  readonly terminalSessions: Readonly<Record<SessionId, 'open' | 'closed'>>;
  readonly terminalTabs: Readonly<Record<SessionId, readonly TerminalTab[]>>;
  readonly activeTerminalTab: Readonly<Record<SessionId, TerminalTabId | null>>;
};
