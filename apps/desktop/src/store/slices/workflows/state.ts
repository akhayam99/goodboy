import type {
  OrchestratorRouting,
  WorkspaceId,
  Workflow,
  StepDef,
  SessionId,
  Agent,
  WorkflowRunId,
  AgentId,
} from '@goodboy/types';

export type RunIdleEpisode = {
  readonly since: number;
  readonly nudges: number;
  readonly lastNudgeAt: number | null;
};

type PendingOrchestration = {
  readonly sessionId: SessionId;
  readonly bypassGate: boolean;
  readonly routing?: OrchestratorRouting;
};

export type WorkflowsState = {
  readonly phaseTemplates: Readonly<Record<WorkspaceId, ReadonlyArray<Workflow>>>;
  readonly stepLibrary: Readonly<Record<WorkspaceId, ReadonlyArray<StepDef>>>;
  readonly sessionWorkflows: Readonly<Record<SessionId, ReadonlyArray<Workflow>>>;
  readonly sessionPhaseRuns: Readonly<Record<SessionId, ReadonlyArray<Agent>>>;
  readonly orchestratingWorkflowRuns: Readonly<Record<WorkflowRunId, boolean>>;
  readonly decisionRestartMarks: Readonly<Record<WorkflowRunId, number>>;
  readonly orchestratorReadingHints: Readonly<Record<WorkflowRunId, ReadonlyArray<string>>>;
  readonly pendingOrchestrations: Readonly<Record<WorkflowRunId, PendingOrchestration>>;
  readonly pendingAdvanceSessions: ReadonlySet<SessionId>;
  readonly runIdleEpisodes: Readonly<Record<WorkflowRunId, RunIdleEpisode>>;
  readonly announcedWorkflowBlocks: Readonly<Record<WorkflowRunId, string>>;
  readonly announcedRunBudget: Readonly<Record<WorkflowRunId, number>>;
  readonly clusterStartAttempts: Readonly<Record<AgentId, number>>;
  readonly clusterStepStartAttempts: Readonly<Record<AgentId, number>>;
  readonly workflowContinueAttempts: Readonly<Record<AgentId, number>>;
  readonly stepSummaryDegraded: Readonly<Record<AgentId, boolean>>;
  readonly degradedStepOutputs: Readonly<Record<AgentId, string>>;
  readonly scoutSelfExploreTasked: Readonly<Record<AgentId, true>>;
};

export const workflowsInitialState: WorkflowsState = {
  phaseTemplates: {},
  stepLibrary: {},
  sessionWorkflows: {},
  sessionPhaseRuns: {},
  orchestratingWorkflowRuns: {},
  decisionRestartMarks: {},
  orchestratorReadingHints: {},
  pendingOrchestrations: {},
  pendingAdvanceSessions: new Set<SessionId>(),
  runIdleEpisodes: {},
  announcedWorkflowBlocks: {},
  announcedRunBudget: {},
  clusterStartAttempts: {},
  clusterStepStartAttempts: {},
  workflowContinueAttempts: {},
  stepSummaryDegraded: {},
  degradedStepOutputs: {},
  scoutSelfExploreTasked: {},
};
