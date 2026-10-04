import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStorySpies,
  storySpies,
  type StoryStore,
} from './storyHarness';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  Session,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { agentHasUnread } from './slices/agents/agentHasUnread';
import { deriveSessionStage } from './slices/session-view/deriveSessionStage';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const callOrder: string[] = [];
const markViewedSpy = storySpies.invokeAgentMarkViewed;
const unreadSpy = storySpies.invokeWorkspacesWithUnread;

const SESSION_ID = 'session-vs-1' as SessionId;
const AGENT_ID = 'agent-vs-1' as AgentId;
const WORKSPACE_ID = 'workspace-vs-1' as WorkspaceId;
const T1 = '2026-05-01T10:00:00.000Z' as IsoDateTime;
const T2 = '2026-05-01T11:00:00.000Z' as IsoDateTime;
const T3 = '2026-05-01T12:00:00.000Z' as IsoDateTime;

function buildSession(): Session {
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'viewed stamping test',
    state: { kind: 'idle', lastActivityAt: T1 },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions',
    workflowRuns: [],
    autoRun: false,
    titleUserEdited: false,
    createdAt: T1,
    updatedAt: T1,
  };
}

function buildAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 1,
    name: 'Agent 1',
    status: 'completed',
    ...overrides,
  };
}

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(() => {
  resetStorySpies();
  callOrder.length = 0;
  markViewedSpy.mockImplementation(async (id) => {
    callOrder.push(`mark:${id}`);
  });
  unreadSpy.mockImplementation(async () => {
    callOrder.push('refresh');
    return [];
  });
});

describe('markAgentViewed', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('stamps lastViewedAt when agent has lastFinishedAt and no lastViewedAt', async () => {
    const agent = buildAgent({ lastFinishedAt: T2 });
    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
    });

    await useAppStore.getState().markAgentViewed(SESSION_ID, AGENT_ID);

    const runs = useAppStore.getState().sessionPhaseRuns[SESSION_ID] ?? [];
    const updated = runs.find((r) => r.id === AGENT_ID);
    expect(updated?.lastViewedAt).toBeDefined();
    expect(updated?.lastViewedAt! >= T2).toBe(true);
    expect(markViewedSpy).toHaveBeenCalledOnce();
  });

  it('stamps lastViewedAt when lastFinishedAt > lastViewedAt (stale viewed)', async () => {
    const agent = buildAgent({ lastFinishedAt: T3, lastViewedAt: T2 });
    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
    });

    await useAppStore.getState().markAgentViewed(SESSION_ID, AGENT_ID);

    const runs = useAppStore.getState().sessionPhaseRuns[SESSION_ID] ?? [];
    const updated = runs.find((r) => r.id === AGENT_ID);
    expect(updated?.lastViewedAt! >= T3).toBe(true);
    expect(markViewedSpy).toHaveBeenCalledOnce();
  });

  it('is a no-op when lastViewedAt >= lastFinishedAt', async () => {
    const agent = buildAgent({ lastFinishedAt: T2, lastViewedAt: T3 });
    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
    });

    await useAppStore.getState().markAgentViewed(SESSION_ID, AGENT_ID);

    const runs = useAppStore.getState().sessionPhaseRuns[SESSION_ID] ?? [];
    const updated = runs.find((r) => r.id === AGENT_ID);
    expect(updated?.lastViewedAt).toBe(T3);
    expect(markViewedSpy).not.toHaveBeenCalled();
  });

  it('is a no-op when agent has no lastFinishedAt (not yet terminal)', async () => {
    const agent = buildAgent({ status: 'running' });
    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
    });

    await useAppStore.getState().markAgentViewed(SESSION_ID, AGENT_ID);

    const runs = useAppStore.getState().sessionPhaseRuns[SESSION_ID] ?? [];
    const updated = runs.find((r) => r.id === AGENT_ID);
    expect(updated?.lastViewedAt).toBeUndefined();
    expect(markViewedSpy).not.toHaveBeenCalled();
  });
});

describe('agentHasUnread skipped guard', () => {
  it('returns false for a skipped agent even when finished and never viewed', () => {
    const agent = buildAgent({ status: 'skipped', lastFinishedAt: T2 });
    expect(agentHasUnread(agent, false)).toBe(false);
  });

  it('returns false for a user-completed agent', () => {
    const agent = buildAgent({ status: 'completed', lastFinishedAt: T2, doneAt: T2 });
    expect(agentHasUnread(agent, false)).toBe(false);
  });
});

describe('selectAgent cascades lastViewedAt to descendants', () => {
  afterEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
  });

  it('stamps the selected parent and every descendant in its parentAgentId subtree', async () => {
    const PARENT = 'agent-parent' as AgentId;
    const CHILD = 'agent-child' as AgentId;
    const GRANDCHILD = 'agent-grandchild' as AgentId;

    const parent = buildAgent({ id: PARENT, lastFinishedAt: T2 });
    const child = buildAgent({ id: CHILD, parentAgentId: PARENT, lastFinishedAt: T2 });
    const grandchild = buildAgent({ id: GRANDCHILD, parentAgentId: CHILD, lastFinishedAt: T2 });

    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: { [SESSION_ID]: [parent, child, grandchild] },
      selectedAgentId: {},
    });

    await useAppStore.getState().selectAgent(SESSION_ID, PARENT);

    const runs = useAppStore.getState().sessionPhaseRuns[SESSION_ID] ?? [];
    for (const id of [PARENT, CHILD, GRANDCHILD]) {
      expect(runs.find((r) => r.id === id)?.lastViewedAt).toBeDefined();
    }
    const stamped = markViewedSpy.mock.calls.map((c) => c[0]);
    expect(stamped).toContain(PARENT);
    expect(stamped).toContain(CHILD);
    expect(stamped).toContain(GRANDCHILD);
  });

  it('awaits every mark-viewed write before refreshing unread workspaces', async () => {
    const PARENT = 'agent-parent' as AgentId;
    const CHILD = 'agent-child' as AgentId;

    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: {
        [SESSION_ID]: [
          buildAgent({ id: PARENT, lastFinishedAt: T2 }),
          buildAgent({ id: CHILD, parentAgentId: PARENT, lastFinishedAt: T2 }),
        ],
      },
      selectedAgentId: {},
    });

    await useAppStore.getState().selectAgent(SESSION_ID, PARENT);
    await Promise.resolve();

    const refreshIndex = callOrder.indexOf('refresh');
    expect(refreshIndex).toBeGreaterThan(-1);
    const marksBeforeRefresh = callOrder
      .slice(0, refreshIndex)
      .filter((c) => c.startsWith('mark:'));
    expect(marksBeforeRefresh).toEqual(expect.arrayContaining([`mark:${PARENT}`, `mark:${CHILD}`]));
  });

  it('does not loop forever on a parentAgentId cycle', async () => {
    const A = 'agent-a' as AgentId;
    const B = 'agent-b' as AgentId;

    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: {
        [SESSION_ID]: [
          buildAgent({ id: A, parentAgentId: B, lastFinishedAt: T2 }),
          buildAgent({ id: B, parentAgentId: A, lastFinishedAt: T2 }),
        ],
      },
      selectedAgentId: {},
    });

    await useAppStore.getState().selectAgent(SESSION_ID, A);

    const stamped = markViewedSpy.mock.calls.map((c) => c[0]);
    expect(stamped).toContain(A);
    expect(stamped).toContain(B);
    expect(stamped.length).toBe(2);
  });

  it('does not stamp sibling subtrees outside the selected parent', async () => {
    const PARENT = 'agent-parent' as AgentId;
    const CHILD = 'agent-child' as AgentId;
    const SIBLING = 'agent-sibling' as AgentId;
    const SIBLING_CHILD = 'agent-sibling-child' as AgentId;

    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: {
        [SESSION_ID]: [
          buildAgent({ id: PARENT, lastFinishedAt: T2 }),
          buildAgent({ id: CHILD, parentAgentId: PARENT, lastFinishedAt: T2 }),
          buildAgent({ id: SIBLING, lastFinishedAt: T2 }),
          buildAgent({ id: SIBLING_CHILD, parentAgentId: SIBLING, lastFinishedAt: T2 }),
        ],
      },
      selectedAgentId: {},
    });

    await useAppStore.getState().selectAgent(SESSION_ID, PARENT);

    const runs = useAppStore.getState().sessionPhaseRuns[SESSION_ID] ?? [];
    expect(runs.find((r) => r.id === SIBLING)?.lastViewedAt).toBeUndefined();
    expect(runs.find((r) => r.id === SIBLING_CHILD)?.lastViewedAt).toBeUndefined();
    const stamped = markViewedSpy.mock.calls.map((c) => c[0]);
    expect(stamped).not.toContain(SIBLING);
    expect(stamped).not.toContain(SIBLING_CHILD);
  });
});

describe('markAgentSeen', () => {
  afterEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
  });

  it('stamps the hovered agent and every descendant in its parentAgentId subtree', async () => {
    const parentId = 'seen-parent' as AgentId;
    const childId = 'seen-child' as AgentId;
    const grandchildId = 'seen-grandchild' as AgentId;

    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: {
        [SESSION_ID]: [
          buildAgent({ id: parentId, lastFinishedAt: T2 }),
          buildAgent({ id: childId, parentAgentId: parentId, lastFinishedAt: T2 }),
          buildAgent({ id: grandchildId, parentAgentId: childId, lastFinishedAt: T2 }),
        ],
      },
    });

    await useAppStore.getState().markAgentSeen(SESSION_ID, parentId);

    const runs = useAppStore.getState().sessionPhaseRuns[SESSION_ID] ?? [];
    expect(runs.every((agent) => agent.lastViewedAt != null)).toBe(true);
    expect(markViewedSpy.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining([parentId, childId, grandchildId]),
    );
    expect(unreadSpy).toHaveBeenCalledOnce();
  });
});

describe('markAllAgentsSeen', () => {
  afterEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
  });

  const openQuestion = {
    id: 'question-seen-1' as OpenQuestionId,
    sessionId: SESSION_ID,
    createdByAgentId: AGENT_ID,
    text: 'Which implementation should I use?',
    suggestedAnswers: [],
    isBlocking: false,
    userAnswer: null,
    status: 'open',
    createdAt: T1,
  } satisfies OpenQuestion;

  it('clears every unread agent without changing open questions', async () => {
    const secondAgentId = 'seen-second' as AgentId;
    const questions = [openQuestion];

    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: {
        [SESSION_ID]: [
          buildAgent({ lastFinishedAt: T2 }),
          buildAgent({ id: secondAgentId, lastFinishedAt: T3, lastViewedAt: T2 }),
        ],
      },
      sessionOpenQuestions: { [SESSION_ID]: questions },
    });

    await useAppStore.getState().markAllAgentsSeen(SESSION_ID);

    const state = useAppStore.getState();
    const runs = state.sessionPhaseRuns[SESSION_ID] ?? [];
    expect(runs.some((agent) => agentHasUnread(agent, false))).toBe(false);
    expect(state.sessionOpenQuestions[SESSION_ID]).toBe(questions);
    expect(markViewedSpy.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining([AGENT_ID, secondAgentId]),
    );
    expect(unreadSpy).toHaveBeenCalledOnce();
  });

  it('keeps the session attention stage when open questions remain after the bulk clear', async () => {
    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: {
        [SESSION_ID]: [buildAgent({ lastFinishedAt: T2 })],
      },
      sessionOpenQuestions: { [SESSION_ID]: [openQuestion] },
    });

    await useAppStore.getState().markAllAgentsSeen(SESSION_ID);

    const state = useAppStore.getState();
    const stage = deriveSessionStage({
      session: buildSession(),
      pr: null,
      hasUnread: (state.sessionPhaseRuns[SESSION_ID] ?? []).some((agent) =>
        agentHasUnread(agent, false),
      ),
      openQuestionCount: (state.sessionOpenQuestions[SESSION_ID] ?? []).filter(
        (question) => question.status === 'open',
      ).length,
    });
    expect(stage).toEqual({
      stage: 'attention',
      reason: '1 open question',
      attention: 'open-question',
      addsFact: true,
      prState: null,
    });
  });
});

describe('agentHasUnread, after markAgentViewed', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns false after markAgentViewed stamps lastViewedAt', async () => {
    const agent = buildAgent({ lastFinishedAt: T2 });
    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
    });

    await useAppStore.getState().markAgentViewed(SESSION_ID, AGENT_ID);

    const runs = useAppStore.getState().sessionPhaseRuns[SESSION_ID] ?? [];
    const updated = runs.find((r) => r.id === AGENT_ID)!;
    expect(agentHasUnread(updated, false)).toBe(false);
  });

  it('returns true for a different session agent not yet marked viewed', async () => {
    const OTHER_SESSION = 'session-other' as SessionId;
    const OTHER_AGENT = 'agent-other' as AgentId;

    const currentAgent = buildAgent({ lastFinishedAt: T2 });
    const otherAgent = buildAgent({
      id: OTHER_AGENT,
      sessionId: OTHER_SESSION,
      lastFinishedAt: T3,
    });

    useAppStore.setState({
      sessions: [buildSession()],
      sessionPhaseRuns: {
        [SESSION_ID]: [currentAgent],
        [OTHER_SESSION]: [otherAgent],
      },
    });

    await useAppStore.getState().markAgentViewed(SESSION_ID, AGENT_ID);

    const otherRuns = useAppStore.getState().sessionPhaseRuns[OTHER_SESSION] ?? [];
    const otherUpdated = otherRuns.find((r) => r.id === OTHER_AGENT)!;
    expect(agentHasUnread(otherUpdated, false)).toBe(true);
  });
});
