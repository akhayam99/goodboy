import type { ProviderRunId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import {
  PERSON_ANSWERS,
  useOpenQuestions,
} from '../../../../../features/context/components/QuestionsTab/useOpenQuestions';
import {
  AGENT_BACKFILL_ID,
  AGENT_ROUNDING_ID,
  BUILDER_DRAFT,
  CHAT_AGENTS,
  CHAT_AGENT_RESOLVER_ID,
  CHAT_ARTIFACTS,
  CHAT_MOUNTS,
  CHAT_PLANS,
  CHAT_SESSION,
  CHAT_SESSION_ID,
  DYNAMIC_RUN_ID,
  DYNAMIC_WORKFLOW,
  EARLIER,
  EXPORT_SESSION_ID,
  FLOW_AGENTS,
  FLOW_AGENT_KINDS,
  FLOW_AGENT_MODELS,
  FLOW_AGENT_PROVIDERS,
  FLOW_MOUNTS,
  FLOW_SESSION,
  FLOW_SESSION_ID,
  FLOW_TELEMETRY,
  LEDGER_PROJECT_ID,
  NOW,
  OPEN_QUESTIONS,
  OVERRIDES,
  PRESETS,
  PRICING_SESSION_ID,
  PROJECTS,
  PROVIDERS,
  QUESTION_SIGNALS_ID,
  RELAY_PROJECT_ID,
  SCRIPTS,
  SESSIONS,
  THREAD_BACKOFF,
  THREAD_ERROR_SHAPE,
  THREAD_SPELLING,
  WORKSPACE,
  WORKSPACE_ID,
  noop,
} from './fixtures';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-09-16T11:20:00.000Z' });

const seedFlowAuditBase = () => {
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE_ID,
    projects: PROJECTS,
    sessions: SESSIONS,
    providers: PROVIDERS,
    workspaceOverrides: { [WORKSPACE_ID]: OVERRIDES },
    phaseTemplates: { [WORKSPACE_ID]: PRESETS },
    projectScripts: { [WORKSPACE_ID]: SCRIPTS },
    sessionProjectMounts: {
      [FLOW_SESSION_ID]: FLOW_MOUNTS,
      [CHAT_SESSION_ID]: CHAT_MOUNTS,
    },
    sessionActiveProject: {
      [FLOW_SESSION_ID]: LEDGER_PROJECT_ID,
      [CHAT_SESSION_ID]: RELAY_PROJECT_ID,
    },
    sessionWorktrees: {
      [FLOW_SESSION_ID]: FLOW_MOUNTS.map((mount) => mount.worktreePath),
      [CHAT_SESSION_ID]: CHAT_MOUNTS.map((mount) => mount.worktreePath),
    },
    sessionBranches: {
      [FLOW_SESSION_ID]: 'nw/fix-settlement-rounding',
      [CHAT_SESSION_ID]: 'nw/fix-retry-storm',
      [EXPORT_SESSION_ID]: 'nw/feat-monthly-ledger-export',
      [PRICING_SESSION_ID]: 'nw/refactor-rate-table',
    },
    sessionWorktreeRecords: {
      [FLOW_SESSION_ID]: FLOW_MOUNTS.map((mount, index) => ({
        id: `mock-flow-worktree-${index}`,
        sessionId: FLOW_SESSION_ID,
        worktreePath: mount.worktreePath,
        branch: mount.branch,
        parallelIndex: index,
        projectId: mount.projectId,
        mountName: mount.mountName,
        repoSlug: `harborline/${mount.mountName}`,
        createdAt: Date.parse(EARLIER),
      })),
      [CHAT_SESSION_ID]: CHAT_MOUNTS.map((mount, index) => ({
        id: `mock-flow-chat-worktree-${index}`,
        sessionId: CHAT_SESSION_ID,
        worktreePath: mount.worktreePath,
        branch: mount.branch,
        parallelIndex: index,
        projectId: mount.projectId,
        mountName: mount.mountName,
        repoSlug: `harborline/${mount.mountName}`,
        createdAt: Date.parse(EARLIER),
      })),
    },
    sessionSlots: {
      [FLOW_SESSION_ID]: FLOW_SESSION.contextSlots,
      [CHAT_SESSION_ID]: CHAT_SESSION.contextSlots,
    },
    sessionSlotsLoad: { [FLOW_SESSION_ID]: 'loaded', [CHAT_SESSION_ID]: 'loaded' },
    sessionLoading: {
      [FLOW_SESSION_ID]: {
        agents: false,
        transcript: false,
        telemetry: false,
        slots: false,
        plans: false,
        summary: false,
      },
      [CHAT_SESSION_ID]: {
        agents: false,
        transcript: false,
        telemetry: false,
        slots: false,
        plans: false,
        summary: false,
      },
    },
    summarizerStatus: {
      [FLOW_SESSION_ID]: {
        status: 'idle',
        lastUpdate: NOW,
        error: null,
        lastUsage: null,
        lastAttempt: null,
      },
      [CHAT_SESSION_ID]: {
        status: 'idle',
        lastUpdate: NOW,
        error: null,
        lastUsage: null,
        lastAttempt: null,
      },
    },
    sessionAttachments: { [FLOW_SESSION_ID]: [], [CHAT_SESSION_ID]: [] },
    workflowRunAttachments: {},
    workspaceIntegrations: { [WORKSPACE_ID]: [] },
    scriptRuns: {},
    activeLens: { [FLOW_SESSION_ID]: null, [CHAT_SESSION_ID]: null },
    loadGoalAttachments: async () => undefined,
    loadSessionEvents: async () => undefined,
    loadSessionArtifacts: async () => undefined,
    navigate: () => undefined,
    loadAgentTranscript: async () => undefined,
  });
};

export const seedWorkflowBuilder = () => {
  seedFlowAuditBase();
  useAppStore.setState({
    currentSessionId: FLOW_SESSION_ID,
    workflowDrafts: { [FLOW_SESSION_ID]: BUILDER_DRAFT },
    sessionPhaseRuns: { [FLOW_SESSION_ID]: FLOW_AGENTS, [CHAT_SESSION_ID]: CHAT_AGENTS },
    sessionWorkflows: { [FLOW_SESSION_ID]: [DYNAMIC_WORKFLOW] },
    sessionTelemetry: { [FLOW_SESSION_ID]: FLOW_TELEMETRY },
    agentKindOverride: FLOW_AGENT_KINDS,
  });
};

export const seedWorkflowRun = () => {
  seedFlowAuditBase();
  useAppStore.setState({
    currentSessionId: FLOW_SESSION_ID,
    sessionPhaseRuns: { [FLOW_SESSION_ID]: FLOW_AGENTS, [CHAT_SESSION_ID]: CHAT_AGENTS },
    sessionWorkflows: { [FLOW_SESSION_ID]: [DYNAMIC_WORKFLOW] },
    sessionTelemetry: { [FLOW_SESSION_ID]: FLOW_TELEMETRY },
    agentKindOverride: FLOW_AGENT_KINDS,
    agentModelOverride: FLOW_AGENT_MODELS,
    agentProviderOverride: FLOW_AGENT_PROVIDERS,
    agentRunHistory: {},
    agentTurnState: {
      [AGENT_BACKFILL_ID]: {
        kind: 'running',
        runId: 'mock-flow-provider-run-backfill' as ProviderRunId,
        startedAt: clock.iso({ at: '2026-09-16T10:34:00.000Z' }),
      },
    },
    orchestratingWorkflowRuns: { [DYNAMIC_RUN_ID]: false },
    selectedAgentId: { [FLOW_SESSION_ID]: AGENT_ROUNDING_ID },
    focusedWorkflowRunId: { [FLOW_SESSION_ID]: DYNAMIC_RUN_ID },
    sessionOpenQuestions: { [FLOW_SESSION_ID]: [] },
    budgetAlerts: [],
  });
};

export const seedChatSurfaces = () => {
  seedFlowAuditBase();
  useAppStore.setState({
    currentSessionId: CHAT_SESSION_ID,
    sessionPhaseRuns: { [CHAT_SESSION_ID]: CHAT_AGENTS },
    sessionWorkflows: { [CHAT_SESSION_ID]: [] },
    sessionOpenQuestions: { [CHAT_SESSION_ID]: OPEN_QUESTIONS },
    selectedAgentId: { [CHAT_SESSION_ID]: CHAT_AGENT_RESOLVER_ID },
    sessionPlans: { [CHAT_SESSION_ID]: CHAT_PLANS },
    sessionArtifacts: { [CHAT_SESSION_ID]: CHAT_ARTIFACTS },
    sessionResolveThreads: { [CHAT_SESSION_ID]: [] },
    sessionGithub: {
      [CHAT_SESSION_ID]: {
        linkedIssues: [],
        pr: null,
        fetchedAt: NOW,
        failedAt: null,
        loading: false,
        error: null,
        detail: {
          prNumber: 412,
          comments: [
            {
              id: 'mock-flow-comment-backoff',
              author: 'kwatanabe',
              authorAvatarUrl: null,
              body: 'The retry timer has no jitter, a single outage will synchronize every relay.',
              createdAt: clock.iso({ at: '2026-09-16T09:52:00.000Z' }),
              url: 'https://example.invalid/harborline/payments-api/pull/412#discussion_1',
              source: 'review',
              path: 'src/relay/retry.ts',
              line: 64,
              resolved: true,
              threadId: THREAD_BACKOFF,
            },
            {
              id: 'mock-flow-comment-error-shape',
              author: 'a-delgado',
              authorAvatarUrl: null,
              body: 'A 409 here loses the retry hint, the relay cannot tell a duplicate from a conflict.',
              createdAt: clock.iso({ at: '2026-09-16T09:58:00.000Z' }),
              url: 'https://example.invalid/harborline/payments-api/pull/412#discussion_2',
              source: 'review',
              path: 'src/settlement/handler.ts',
              line: 118,
              resolved: false,
              threadId: THREAD_ERROR_SHAPE,
            },
            {
              id: 'mock-flow-comment-spelling',
              author: 'kwatanabe',
              authorAvatarUrl: null,
              body: 'Field name reads oddly here.',
              createdAt: clock.iso({ at: '2026-09-16T10:01:00.000Z' }),
              url: 'https://example.invalid/harborline/payments-api/pull/412#discussion_3',
              source: 'review',
              path: 'src/settlement/schema.ts',
              line: 22,
              resolved: false,
              threadId: THREAD_SPELLING,
            },
          ],
          reviews: [],
          reviewRequests: [],
          checks: [],
        },
        detailFetchedAt: NOW,
        detailLoading: false,
        detailError: null,
      },
    },
  });
  useOpenQuestions.setState({
    drafts: {
      [QUESTION_SIGNALS_ID]: {
        selectedSuggestions: ['Connection resets', 'HTTP 429 with a retry hint'],
        customAnswer: '',
        showCustomField: false,
        answerIntent: PERSON_ANSWERS,
      },
    },
    justAnswered: [],
  });
};
