import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  MountId,
  ProjectId,
  Session,
  SessionEventId,
  SessionId,
  StepId,
  WorkflowRunId,
} from '@goodboy/types';
import type { SessionSuggestion } from '../types';

const { storeState, spies } = vi.hoisted(() => {
  const materializeProject = vi.fn(async () => undefined);
  const recordSessionEvent = vi.fn(async () => undefined);
  const setSessionActiveProject = vi.fn(async () => undefined);
  const emitNotification = vi.fn(async () => undefined);
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
  const setActiveLens = vi.fn();
  const rebaseRun = vi.fn(async () => undefined);
  return {
    spies: {
      materializeProject,
      recordSessionEvent,
      setSessionActiveProject,
      emitNotification,
      advanceAgent: vi.fn(async () => undefined),
      spawnAgent,
      setAgentConfig,
      setActiveLens,
      rebaseRun,
      worktreeStatuses: vi.fn(() => new Map<string, unknown>()),
      useRebaseAgent: vi.fn((_params: unknown) => ({
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
      materializeProject,
      recordSessionEvent,
      setSessionActiveProject,
      emitNotification,
      spawnAgent,
      setAgentConfig,
      setActiveLens,
    },
  };
});

vi.mock('../../../store', () => {
  const useAppStore = <T>(selector: (state: typeof storeState) => T) => selector(storeState);
  return { EMPTY_ARRAY: Object.freeze([]), useAppStore };
});
vi.mock('../../../shared/hooks/useSessionRoleModels', () => ({
  useSessionRoleModels: () => ({}),
}));
vi.mock('../../session/agent-kind', () => ({
  kindRouting: () => ({ provider: 'anthropic', model: 'claude', effort: 'medium' }),
}));
vi.mock('../../session/hooks/useWorktreeStatuses', () => ({
  useWorktreeStatuses: spies.worktreeStatuses,
}));
vi.mock('../../session/hooks/useRebaseAgent', () => ({
  useRebaseAgent: spies.useRebaseAgent,
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

const SESSION = { id: SESSION_ID, workspaceId: 'workspace-1' } as Session;

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

const suggestionBase = { sessionId: SESSION_ID, priority: 0, title: 'Do it' };

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
    actions.primary?.onAct();

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
              author: 'dhh',
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

    expect(actions.primary?.label).toBe('Fix all');
    actions.primary?.onAct();
    await vi.waitFor(() => expect(spies.spawnAgent).toHaveBeenCalledTimes(1));
    expect(spies.spawnAgent.mock.calls[0]?.[1].sourceThreadIds).toEqual(['thread-1']);
    expect(spies.spawnAgent.mock.calls[0]?.[1].kindOverride).toBe('resolver');
    await vi.waitFor(() => expect(spies.setActiveLens).toHaveBeenCalledWith(SESSION_ID, 'review'));
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
              author: 'dhh',
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
              author: 'dhh',
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
              author: 'dhh',
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
    actions.primary?.onAct();

    await vi.waitFor(() => expect(spies.spawnAgent).toHaveBeenCalledTimes(1));
    expect(spies.spawnAgent.mock.calls[0]?.[1].sourceThreadIds).toEqual([
      'thread-1',
      'thread-2',
      'thread-3',
    ]);
  });

  it('activates the project before running the rebase agent', async () => {
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
    actions.primary?.onAct();

    await vi.waitFor(() => expect(spies.rebaseRun).toHaveBeenCalledTimes(1));
    expect(spies.setSessionActiveProject).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      projectId: WEB_ID,
      mountId: WEB_MOUNT_ID,
    });
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
    actions.primary?.choices?.[1]?.onAct();

    await vi.waitFor(() => expect(spies.rebaseRun).toHaveBeenCalledTimes(1));
    expect(spies.setSessionActiveProject).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      projectId: WEB_ID,
      mountId: WEB_SECOND_MOUNT_ID,
    });
    expect(spies.rebaseRun).toHaveBeenCalledWith({ mountId: WEB_SECOND_MOUNT_ID, behind: 3 });
  });

  it('starts a mountless target by project id', async () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'rebase-project:session-1',
        kind: 'rebase-project',
        payload: {
          targets: [
            {
              id: 'worktree:/tmp/web',
              mountId: null,
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

    actions.primary?.onAct();

    await vi.waitFor(() => expect(spies.rebaseRun).toHaveBeenCalledTimes(1));
    expect(spies.setSessionActiveProject).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      projectId: WEB_ID,
    });
    expect(spies.rebaseRun).toHaveBeenCalledWith({ projectId: WEB_ID, behind: 2 });
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
    expect(spies.useRebaseAgent).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: activeStatus }),
    );
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
    actions.primary?.onAct();

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

    expect(actions.primary?.label).toBe('Mount project');
    actions.primary?.onAct();

    expect(spies.materializeProject).toHaveBeenCalledWith({
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

  it('leaves the plan-ready suggestion to the composer', () => {
    const actions = actionsFor({
      suggestion: {
        ...suggestionBase,
        id: 'plan-ready:plan-1',
        kind: 'plan-ready',
        payload: { planId: 'plan-1' as never },
      },
    });

    expect(actions.primary).toBeNull();
    expect(actions.onDismiss).toBeNull();
  });
});
