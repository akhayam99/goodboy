import { beforeEach, describe, expect, it, vi } from 'vitest';
import { agentPlace, sessionPlace } from '../../../store/slices/navigation/place';
import { renderHook } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  MountId,
  PlanId,
  ProjectId,
  Session,
  SessionEventId,
  SessionId,
  StepId,
  WorkflowId,
  WorkflowRunId,
} from '@goodboy/types';
import { SUGGESTION_KINDS, type SessionSuggestion, type SuggestionKind } from '../types';

const { storeState, spies } = vi.hoisted(() => {
  const ensureProjectMounted = vi.fn(async () => undefined);
  const recordSessionEvent = vi.fn(async () => undefined);
  const setSessionActiveProject = vi.fn(async () => undefined);
  const emitNotification = vi.fn(async () => undefined);
  const reportError = vi.fn(async (_params: unknown) => undefined);
  const spawnAgent = vi.fn(
    async (
      sessionId: string,
      args: { readonly sourceThreadIds?: ReadonlyArray<string>; readonly kindOverride?: string },
    ) => {
      void sessionId;
      void args;
      return 'agent-resolver';
    },
  );
  const setAgentConfig = vi.fn(async (sessionId: string, agentId: string, fields: unknown) => {
    void sessionId;
    void agentId;
    void fields;
  });
  const navigate = vi.fn();
  const rebaseRun = vi.fn(async () => undefined);
  const runPlan = vi.fn(async () => 'agent-implementer');
  const skipStuckStepAndAdvance = vi.fn(async () => undefined);
  const pushSessionBranch = vi.fn(async () => ({ ok: true as const }));
  const createPrForSession = vi.fn(async () => undefined);
  const markPrReady = vi.fn(async () => undefined);
  const mergePr = vi.fn(async () => undefined);
  const resolveMountCleanup = vi.fn(async () => undefined);
  const attachWorkflowToSession = vi.fn(async () => undefined);
  const announceAgentStarted = vi.fn();
  return {
    spies: {
      ensureProjectMounted,
      recordSessionEvent,
      setSessionActiveProject,
      emitNotification,
      reportError,
      advanceAgent: vi.fn(async () => undefined),
      spawnAgent,
      setAgentConfig,
      navigate,
      rebaseRun,
      runPlan,
      skipStuckStepAndAdvance,
      pushSessionBranch,
      createPrForSession,
      markPrReady,
      mergePr,
      resolveMountCleanup,
      attachWorkflowToSession,
      announceAgentStarted,
      worktreeStatuses: vi.fn(() => new Map<string, unknown>()),
      useRebaseBranch: vi.fn((_params: unknown) => ({
        canRebase: false,
        isRunning: false,
        error: null,
        run: rebaseRun,
      })),
    },
    storeState: {
      sessionGithub: {} as Record<string, unknown>,
      sessionResolveThreads: {} as Record<string, ReadonlyArray<unknown>>,
      sessionProjectMounts: {} as Record<string, ReadonlyArray<unknown>>,
      mountGithub: {} as Record<string, unknown>,
      mountGitlabMr: {} as Record<string, unknown>,
      mountBitbucketPr: {} as Record<string, unknown>,
      projects: [] as ReadonlyArray<unknown>,
      ensureProjectMounted,
      recordSessionEvent,
      setSessionActiveProject,
      emitNotification,
      reportError,
      spawnAgent,
      setAgentConfig,
      runPlan,
      navigate,
      skipStuckStepAndAdvance,
      pushSessionBranch,
      createPrForSession,
      markPrReady,
      mergePr,
      resolveMountCleanup,
      attachWorkflowToSession,
    },
  };
});

vi.mock('../../../store', async () => {
  const useAppStore = <T>(selector: (state: typeof storeState) => T) => selector(storeState);
  return {
    ...(await import('../../../store/slices/navigation/place')),
    EMPTY_ARRAY: Object.freeze([]),
    useAppStore,
  };
});
vi.mock('../../../shared/hooks/useSessionRoleModels', () => ({
  useSessionRoleModels: () => ({}),
}));
vi.mock('../../../shared/hooks/useAgentStartedToast', () => ({
  useAgentStartedToast: () => spies.announceAgentStarted,
}));
vi.mock('../../session/agent-kind', () => ({
  kindRouting: () => ({ provider: 'anthropic', model: 'claude', effort: 'medium' }),
}));
vi.mock('../../session/hooks/useWorktreeStatuses', () => ({
  useWorktreeStatuses: spies.worktreeStatuses,
}));
vi.mock('../../session/hooks/useRebaseBranch', () => ({
  REBASE_FAILURE_TITLE: "Couldn't rebase the branch",
  useRebaseBranch: spies.useRebaseBranch,
}));
vi.mock('../../workflows/useAdvanceWorkflowAgent', () => ({
  useAdvanceWorkflowAgent: () => spies.advanceAgent,
}));
vi.mock('../../github/comment-threads', () => ({
  groupThreads: (comments: ReadonlyArray<unknown>) =>
    comments.map((comment) => ({ head: comment, replies: [] })),
}));
vi.mock('../../session/contextWindowFor', () => ({ contextWindowFor: () => null }));

import { useSuggestionActions } from './index';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const STEP_ID = 'step-1' as StepId;
const WEB_ID = 'project-web' as ProjectId;
const WEB_MOUNT_ID = 'mount-web' as MountId;
const WEB_SECOND_MOUNT_ID = 'mount-web-second' as MountId;
const AGENT_ID = 'agent-1' as AgentId;

const SESSION = { id: SESSION_ID, workspaceId: 'workspace-1', goal: 'Ship the thing' } as Session;

const PENDING_AGENT = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  stepId: STEP_ID,
  status: 'pending',
} as unknown as Agent;

const onSelectQuestions = vi.fn();

const actionsFor = ({ suggestion }: { readonly suggestion: SessionSuggestion }) => {
  const { result } = renderHook(() =>
    useSuggestionActions({ session: SESSION, agents: [PENDING_AGENT], onSelectQuestions }),
  );
  return result.current({ suggestion });
};

const suggestionBase = {
  sessionId: SESSION_ID,
  priority: 0,
  title: 'Do it',
  band: 1 as const,
  fingerprint: 'test-fingerprint',
  targetKey: null,
};

beforeEach(() => {
  storeState.sessionGithub = {};
  storeState.sessionResolveThreads = {};
  storeState.sessionProjectMounts = {};
  storeState.mountGithub = {};
  storeState.mountGitlabMr = {};
  storeState.mountBitbucketPr = {};
  storeState.projects = [];
  spies.worktreeStatuses.mockReturnValue(new Map());
  onSelectQuestions.mockReset();
  for (const spy of Object.values(spies)) {
    spy.mockClear();
  }
});

describe('useSuggestionActions', () => {
  it('advances the pending step behind a workflow suggestion', () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'workflow-next-step:run-1',
        kind: 'workflow-next-step',
        payload: { runId: RUN_ID, stepId: STEP_ID },
      },
    });

    expect(actions.primary?.label).toBe('Continue');
    actions.primary?.run();

    expect(spies.advanceAgent).toHaveBeenCalledWith({ agent: PENDING_AGENT });
  });

  it('spawns a resolver per eligible thread', async () => {
    storeState.sessionGithub = {
      [SESSION_ID]: {
        pr: { number: 12, headBranch: 'feature/retry' },
        detail: {
          comments: [
            {
              id: '1',
              source: 'review',
              resolved: false,
              threadId: 'thread-1',
              url: 'u',
              body: 'rename it',
              author: 'harbor-reviewer',
              createdAt: '2026-01-01T00:00:00Z',
              path: 'a.ts',
            },
          ],
        },
      },
    };

    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'resolve-threads:session-1',
        kind: 'resolve-threads',
        payload: { eligibleThreadCount: 1 },
      },
    });

    expect(actions.primary?.label).toBe('Draft a fix');
    actions.primary?.run();
    await vi.waitFor(() => expect(spies.spawnAgent).toHaveBeenCalledTimes(1));
    expect(spies.spawnAgent.mock.calls[0]?.[1].sourceThreadIds).toEqual(['thread-1']);
    expect(spies.spawnAgent.mock.calls[0]?.[1].kindOverride).toBe('resolver');
    await vi.waitFor(() =>
      expect(spies.navigate).toHaveBeenCalledWith({
        to: sessionPlace({ sessionId: SESSION_ID, lens: 'review' }),
      }),
    );
  });

  it('combines every eligible conversation into one attempt instead of one agent each', async () => {
    storeState.sessionGithub = {
      [SESSION_ID]: {
        pr: { number: 12, headBranch: 'feature/retry', title: 't', url: 'u' },
        detail: {
          comments: [
            {
              source: 'review',
              resolved: false,
              threadId: 'thread-1',
              url: 'u',
              body: 'a',
              path: 'a.ts',
              author: 'harbor-reviewer',
              createdAt: '2026-01-01T00:00:00Z',
              id: '1',
            },
            {
              source: 'review',
              resolved: false,
              threadId: 'thread-2',
              url: 'u',
              body: 'b',
              path: 'a.ts',
              author: 'harbor-reviewer',
              createdAt: '2026-01-01T00:00:00Z',
              id: '2',
            },
            {
              source: 'review',
              resolved: false,
              threadId: 'thread-3',
              url: 'u',
              body: 'c',
              path: 'b.ts',
              author: 'harbor-reviewer',
              createdAt: '2026-01-01T00:00:00Z',
              id: '3',
            },
          ],
        },
      },
    };

    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'resolve-threads:session-1',
        kind: 'resolve-threads',
        payload: { eligibleThreadCount: 3 },
      },
    });
    actions.primary?.run();

    await vi.waitFor(() => expect(spies.spawnAgent).toHaveBeenCalledTimes(1));
    expect(spies.spawnAgent.mock.calls[0]?.[1].sourceThreadIds).toEqual([
      'thread-1',
      'thread-2',
      'thread-3',
    ]);
  });

  it('rebases the mount the suggestion names without moving the write destination', async () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'rebase-project:session-1',
        kind: 'rebase-project',
        payload: {
          targets: [
            {
              id: 'mount:mount-web',
              mountId: WEB_MOUNT_ID,
              projectId: WEB_ID,
              projectName: 'web',
              branch: 'feature/web',
              worktreePath: '/tmp/web',
              baseBranch: 'main',
              behind: 2,
            },
          ],
        },
      },
    });

    expect(actions.primary?.label).toBe('Rebase');
    expect(actions.primary?.isDisabled).toBe(false);
    actions.primary?.run();

    await vi.waitFor(() => expect(spies.rebaseRun).toHaveBeenCalledTimes(1));
    expect(spies.setSessionActiveProject).not.toHaveBeenCalled();
    expect(spies.rebaseRun).toHaveBeenCalledWith({ mountId: WEB_MOUNT_ID, behind: 2 });
  });

  it('runs the second rebase choice with that mount and distance', async () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'rebase-project:session-1',
        kind: 'rebase-project',
        payload: {
          targets: [
            {
              id: 'mount:mount-web',
              mountId: WEB_MOUNT_ID,
              projectId: WEB_ID,
              projectName: 'web',
              branch: 'feature/web-first',
              worktreePath: '/tmp/web-first',
              baseBranch: 'main',
              behind: 7,
            },
            {
              id: 'mount:mount-web-second',
              mountId: WEB_SECOND_MOUNT_ID,
              projectId: WEB_ID,
              projectName: 'web',
              branch: 'feature/web-second',
              worktreePath: '/tmp/web-second',
              baseBranch: 'main',
              behind: 3,
            },
          ],
        },
      },
    });

    expect(actions.primary?.choices?.[1]?.description).toBe('feature/web-second');
    actions.primary?.choices?.[1]?.run();

    await vi.waitFor(() => expect(spies.rebaseRun).toHaveBeenCalledTimes(1));
    expect(spies.setSessionActiveProject).not.toHaveBeenCalled();
    expect(spies.rebaseRun).toHaveBeenCalledWith({ mountId: WEB_SECOND_MOUNT_ID, behind: 3 });
  });

  it('ignores completed mounts when polling and choosing the behind status', () => {
    const completedStatus = {
      branch: 'feature/web-merged',
      mainDistance: { kind: 'known', ahead: 0, behind: 9 },
      upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
    };
    const activeStatus = {
      branch: 'feature/web-open',
      mainDistance: { kind: 'known', ahead: 0, behind: 2 },
      upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
    };
    storeState.sessionProjectMounts = {
      [SESSION_ID]: [
        {
          mountId: WEB_MOUNT_ID,
          projectId: WEB_ID,
          mountName: 'web merged',
          worktreePath: '/tmp/web-merged',
          branch: 'feature/web-merged',
        },
        {
          mountId: WEB_SECOND_MOUNT_ID,
          projectId: WEB_ID,
          mountName: 'web open',
          worktreePath: '/tmp/web-open',
          branch: 'feature/web-open',
        },
      ],
    };
    storeState.projects = [{ id: WEB_ID, baseBranch: 'main' }];
    storeState.mountGithub = {
      [WEB_MOUNT_ID]: {
        pr: {
          number: 12,
          state: 'merged',
          title: 'Merged request',
          url: 'https://github.com/acme/web/pull/12',
          isDraft: false,
        },
      },
    };
    spies.worktreeStatuses.mockReturnValue(
      new Map([
        ['/tmp/web-merged', completedStatus],
        ['/tmp/web-open', activeStatus],
      ]),
    );

    actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'workflow-next-step:run-1',
        kind: 'workflow-next-step',
        payload: { runId: RUN_ID, stepId: STEP_ID },
      },
    });

    expect(spies.worktreeStatuses).toHaveBeenLastCalledWith({
      targets: [{ worktreePath: '/tmp/web-open', baseBranch: 'main' }],
    });
    expect(spies.useRebaseBranch).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: activeStatus }),
    );
  });

  it('starts the implementer with the plan behind a plan-ready suggestion, then announces it', async () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'plan-ready:plan-1',
        kind: 'plan-ready',
        payload: { planId: 'plan-1' as PlanId },
      },
    });

    expect(actions.primary?.label).toBe('Start implementer');
    actions.primary?.run();

    expect(spies.runPlan).toHaveBeenCalledWith(SESSION_ID, 'plan-1');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(spies.announceAgentStarted).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: 'agent-implementer',
      title: 'Implementer started',
      message: 'An agent is running this plan. You can keep working.',
    });
  });

  it('hands the questions lens the answer action', () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'answer-questions:session-1',
        kind: 'answer-questions',
        payload: { count: 2 },
      },
    });

    expect(actions.primary?.label).toBe('Answer');
    actions.primary?.run();

    expect(onSelectQuestions).toHaveBeenCalledTimes(1);
  });

  it('mounts a proposed project with the reason the agent recorded', () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'mount-project:project-web',
        kind: 'mount-project',
        payload: {
          projectId: WEB_ID,
          projectName: 'web',
          reason: 'needs the router',
          agentId: AGENT_ID,
          eventId: 'event-1' as SessionEventId,
        },
      },
    });

    expect(actions.primary?.label).toBe('Add project');
    actions.primary?.run();

    expect(spies.ensureProjectMounted).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      projectId: WEB_ID,
      reason: 'needs the router',
    });
  });

  it('records the decline when the proposal is dismissed', () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'mount-project:project-web',
        kind: 'mount-project',
        payload: {
          projectId: WEB_ID,
          projectName: 'web',
          reason: 'needs the router',
          agentId: AGENT_ID,
          eventId: 'event-1' as SessionEventId,
        },
      },
    });

    actions.onDismiss?.();

    expect(spies.recordSessionEvent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'project_materialization_dismissed',
      payload: { projectId: WEB_ID, projectName: 'web', reason: 'needs the router' },
    });
  });

  it('opens the agent to review a pending permission request', () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'approve-tool:agent-1',
        kind: 'approve-tool',
        band: 0,
        payload: {
          agentId: AGENT_ID,
          agentLabel: 'Tester',
          toolUseId: 'tool-1',
          toolName: 'pnpm test',
        },
      },
    });

    expect(actions.primary?.label).toBe('Review');
    actions.primary?.run();

    expect(spies.navigate).toHaveBeenCalledWith({
      to: agentPlace({ sessionId: SESSION_ID, agentId: AGENT_ID }),
    });
  });

  it('dispatches the provider sign-in flow', () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:open-settings', listener);
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'sign-in:agent-1',
        kind: 'sign-in',
        band: 0,
        payload: { agentId: AGENT_ID, agentLabel: 'Implementer', providerId: 'anthropic' },
      },
    });

    expect(actions.primary?.label).toBe('Sign in');
    actions.primary?.run();

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toEqual({ scope: 'providers', provider: 'anthropic', action: 'login' });
    window.removeEventListener('goodboy:open-settings', listener);
  });

  it('skips a blocked step behind a confirm', () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'unblock-step:run-1',
        kind: 'unblock-step',
        band: 0,
        payload: { runId: RUN_ID, stepId: STEP_ID, stepLabel: 'Tester' },
      },
    });

    expect(actions.primary?.label).toBe('Skip');
    expect(actions.primary?.requiresConfirm).toBe(true);
    actions.primary?.run();

    expect(spies.skipStuckStepAndAdvance).toHaveBeenCalledWith(SESSION_ID, RUN_ID, {
      onlyWhenBlocked: true,
    });
  });

  it('retries a failed standalone agent as the same role', () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'retry-agent:agent-1',
        kind: 'retry-agent',
        payload: { agentId: AGENT_ID, agentKind: 'debugger' },
      },
    });

    expect(actions.primary?.label).toBe('Retry');
    actions.primary?.run();

    expect(spies.spawnAgent).toHaveBeenCalledWith(SESSION_ID, {
      kindOverride: 'debugger',
      focus: 'none',
    });
  });

  it('starts a reviewer, with a tester as the alternative', () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'check-changes:agent-1',
        kind: 'check-changes',
        band: 3,
        payload: { agentId: AGENT_ID },
      },
    });

    expect(actions.primary?.label).toBe('Start reviewer');
    actions.primary?.run();
    expect(spies.spawnAgent).toHaveBeenCalledWith(SESSION_ID, {
      kindOverride: 'reviewer',
      focus: 'none',
    });

    actions.primary?.choices?.[0]?.run();
    expect(spies.spawnAgent).toHaveBeenCalledWith(SESSION_ID, {
      kindOverride: 'tester',
      focus: 'none',
    });
  });

  it('starts a debugger to fix failing checks', () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'fix-checks:mount-web',
        kind: 'fix-checks',
        band: 1,
        payload: { mountId: WEB_MOUNT_ID, projectName: 'web', prNumber: 618 },
      },
    });

    expect(actions.primary?.label).toBe('Start debugger');
    actions.primary?.run();

    expect(spies.spawnAgent).toHaveBeenCalledWith(SESSION_ID, {
      kindOverride: 'debugger',
      mountId: WEB_MOUNT_ID,
      focus: 'none',
    });
  });

  it('pushes the named mount', () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'push-branch:mount-web',
        kind: 'push-branch',
        band: 2,
        payload: {
          mountId: WEB_MOUNT_ID,
          projectId: WEB_ID,
          projectName: 'web',
          branch: 'feature/web',
          worktreePath: '/tmp/web',
          ahead: 4,
        },
      },
    });

    expect(actions.primary?.label).toBe('Push');
    actions.primary?.run();

    expect(spies.pushSessionBranch).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: WEB_MOUNT_ID,
    });
  });

  it('opens a pull request for the named mount', () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'open-pr:mount-web',
        kind: 'open-pr',
        band: 2,
        payload: { mountId: WEB_MOUNT_ID, projectId: WEB_ID, projectName: 'web', ahead: 7 },
      },
    });

    expect(actions.primary?.label).toBe('Open PR');
    actions.primary?.run();

    expect(spies.createPrForSession).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: WEB_MOUNT_ID,
    });
  });

  it('marks the named pull request ready for review', () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'mark-ready:mount-web',
        kind: 'mark-ready',
        band: 2,
        payload: { mountId: WEB_MOUNT_ID, projectName: 'web', prNumber: 618 },
      },
    });

    expect(actions.primary?.label).toBe('Mark ready');
    actions.primary?.run();

    expect(spies.markPrReady).toHaveBeenCalledWith(SESSION_ID, 618, { mountId: WEB_MOUNT_ID });
  });

  it('merges the named pull request behind a confirm', () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'merge-pr:mount-web',
        kind: 'merge-pr',
        band: 2,
        payload: {
          mountId: WEB_MOUNT_ID,
          projectName: 'web',
          prNumber: 618,
          defaultMethod: 'squash',
        },
      },
    });

    expect(actions.primary?.label).toBe('Merge');
    expect(actions.primary?.requiresConfirm).toBe(true);
    actions.primary?.run();

    expect(spies.mergePr).toHaveBeenCalledWith(SESSION_ID, 618, 'squash', {
      mountId: WEB_MOUNT_ID,
    });
  });

  it('removes the worktree on close, keeps it on dismiss', () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'close-worktree:mount-web',
        kind: 'close-worktree',
        band: 3,
        payload: {
          mountId: WEB_MOUNT_ID,
          requestId: 'cleanup:merge_cleanup:mount-web:feature/web',
          branch: 'feature/web',
          prNumber: 612,
        },
      },
    });

    expect(actions.primary?.label).toBe('Close worktree');
    expect(actions.primary?.requiresConfirm).toBe(true);
    actions.primary?.run();
    expect(spies.resolveMountCleanup).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      requestId: 'cleanup:merge_cleanup:mount-web:feature/web',
      decision: 'remove',
    });

    actions.onDismiss?.();
    expect(spies.resolveMountCleanup).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      requestId: 'cleanup:merge_cleanup:mount-web:feature/web',
      decision: 'keep',
    });
  });

  it('attaches the recommended workflow with the session goal on Set up', () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'continue-with-workflow:agent-1',
        kind: 'continue-with-workflow',
        band: 3,
        payload: { workflowId: 'workflow-1' as WorkflowId, workflowName: 'Plan and ship' },
      },
    });

    expect(actions.primary?.label).toBe('Set up');
    actions.primary?.run();

    expect(spies.attachWorkflowToSession).toHaveBeenCalledWith(SESSION_ID, 'workflow-1', {
      goal: 'Ship the thing',
      navigate: true,
    });
  });
});

const EVERY_KIND = {
  'workflow-next-step': {
    ...suggestionBase,
    id: 'workflow-next-step:run-1',
    kind: 'workflow-next-step',
    payload: { runId: RUN_ID, stepId: STEP_ID },
  },
  'plan-ready': {
    ...suggestionBase,
    id: 'plan-ready:plan-1',
    kind: 'plan-ready',
    payload: { planId: 'plan-1' as PlanId },
  },
  'resolve-threads': {
    ...suggestionBase,
    id: 'resolve-threads:session-1',
    kind: 'resolve-threads',
    payload: { eligibleThreadCount: 0 },
  },
  'rebase-project': {
    ...suggestionBase,
    id: 'rebase-project:session-1',
    kind: 'rebase-project',
    payload: { targets: [] },
  },
  'answer-questions': {
    ...suggestionBase,
    id: 'answer-questions:session-1',
    kind: 'answer-questions',
    payload: { count: 1 },
  },
  'mount-project': {
    ...suggestionBase,
    id: 'mount-project:project-web',
    kind: 'mount-project',
    payload: {
      projectId: WEB_ID,
      projectName: 'web',
      reason: 'needs the router',
      agentId: AGENT_ID,
      eventId: 'event-1' as SessionEventId,
    },
  },
  'approve-tool': {
    ...suggestionBase,
    id: 'approve-tool:agent-1',
    kind: 'approve-tool',
    payload: { agentId: AGENT_ID, agentLabel: 'Tester', toolUseId: 'tool-1', toolName: 'pnpm' },
  },
  'sign-in': {
    ...suggestionBase,
    id: 'sign-in:agent-1',
    kind: 'sign-in',
    payload: { agentId: AGENT_ID, agentLabel: 'Implementer', providerId: 'anthropic' },
  },
  'unblock-step': {
    ...suggestionBase,
    id: 'unblock-step:run-1',
    kind: 'unblock-step',
    payload: { runId: RUN_ID, stepId: STEP_ID, stepLabel: null },
  },
  'retry-agent': {
    ...suggestionBase,
    id: 'retry-agent:agent-1',
    kind: 'retry-agent',
    payload: { agentId: AGENT_ID, agentKind: 'debugger' },
  },
  'fix-checks': {
    ...suggestionBase,
    id: 'fix-checks:mount-web',
    kind: 'fix-checks',
    payload: { mountId: WEB_MOUNT_ID, projectName: 'web', prNumber: 618 },
  },
  'push-branch': {
    ...suggestionBase,
    id: 'push-branch:mount-web',
    kind: 'push-branch',
    payload: {
      mountId: WEB_MOUNT_ID,
      projectId: WEB_ID,
      projectName: 'web',
      branch: 'feature/web',
      worktreePath: '/tmp/web',
      ahead: 1,
    },
  },
  'open-pr': {
    ...suggestionBase,
    id: 'open-pr:mount-web',
    kind: 'open-pr',
    payload: { mountId: WEB_MOUNT_ID, projectId: WEB_ID, projectName: 'web', ahead: 1 },
  },
  'mark-ready': {
    ...suggestionBase,
    id: 'mark-ready:mount-web',
    kind: 'mark-ready',
    payload: { mountId: WEB_MOUNT_ID, projectName: 'web', prNumber: 618 },
  },
  'merge-pr': {
    ...suggestionBase,
    id: 'merge-pr:mount-web',
    kind: 'merge-pr',
    payload: {
      mountId: WEB_MOUNT_ID,
      projectName: 'web',
      prNumber: 618,
      defaultMethod: 'squash',
    },
  },
  'check-changes': {
    ...suggestionBase,
    id: 'check-changes:agent-1',
    kind: 'check-changes',
    payload: { agentId: AGENT_ID },
  },
  'close-worktree': {
    ...suggestionBase,
    id: 'close-worktree:mount-web',
    kind: 'close-worktree',
    payload: {
      mountId: WEB_MOUNT_ID,
      requestId: 'cleanup:mount-web',
      branch: 'feature/web',
      prNumber: null,
    },
  },
  'continue-with-workflow': {
    ...suggestionBase,
    id: 'continue-with-workflow:agent-1',
    kind: 'continue-with-workflow',
    payload: { workflowId: 'workflow-1' as WorkflowId, workflowName: 'Plan and ship' },
  },
} satisfies { readonly [K in SuggestionKind]: Extract<SessionSuggestion, { readonly kind: K }> };

describe('every suggestion kind', () => {
  it.each(SUGGESTION_KINDS)(
    '%s runs as a promise with a failure title, so the row can show pending',
    async (kind) => {
      const actions = actionsFor({ suggestion: EVERY_KIND[kind] });
      const primary = actions.primary;

      expect(primary).not.toBeNull();
      expect(
        primary?.failureTitle.startsWith("Couldn't") || primary?.failureTitle.includes("didn't"),
      ).toBe(true);
      const pending = primary?.run();
      expect(pending).toBeInstanceOf(Promise);
      await pending;
      for (const choice of primary?.choices ?? []) {
        await expect(choice.run()).resolves.toBeUndefined();
      }
    },
  );

  it('hands a failed push back as a rejection so the row logs it once', async () => {
    spies.pushSessionBranch.mockResolvedValueOnce({ ok: false, error: 'rejected' } as never);
    const actions = actionsFor({ suggestion: EVERY_KIND['push-branch'] });

    await expect(actions.primary?.run()).rejects.toThrow('rejected');
    expect(spies.reportError).not.toHaveBeenCalled();
    expect(spies.emitNotification).not.toHaveBeenCalled();
  });

  it('hands a failed agent start back as a rejection', async () => {
    spies.spawnAgent.mockRejectedValueOnce(new Error('provider unavailable'));
    const actions = actionsFor({ suggestion: EVERY_KIND['fix-checks'] });

    await expect(actions.primary?.run()).rejects.toThrow('provider unavailable');
  });
});
