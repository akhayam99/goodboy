// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => bridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, TurnState } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { bindTarget, runObjectAction } from '../../features/actions/registry';
import type { ActionEnv, ObjectTarget } from '../../features/actions/types';
import {
  AGENT,
  FIXTURE_NOW,
  RUN,
  SESSION,
  STEP_BUILD,
  STEP_PLAN,
  WORKSPACE,
  agentFixture,
  mountFixture,
  questionFixture,
  runFixture,
  seedActionState,
  sessionFixture,
  stepAgent,
  workflowFixture,
  type ActionSeed,
} from '../helpers/actionFixtures';

type BridgeArgs = {
  readonly statements?: ReadonlyArray<unknown>;
};

const bridge = (command: string, args?: BridgeArgs): Promise<unknown> => {
  if (command === 'db_transaction') {
    return Promise.resolve({
      status: 'committed',
      results: (args?.statements ?? []).map(() => ({ rowsAffected: 1, rows: [] })),
    });
  }
  if (command === 'db_select') {
    return Promise.resolve([]);
  }
  if (command === 'db_execute') {
    return Promise.resolve({ rowsAffected: 1, lastInsertId: 0 });
  }
  return Promise.resolve(command.includes('_list') ? [] : null);
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const seed = (value: ActionSeed): void => seedActionState({ useAppStore, seed: value });

const matrixOf = (target: ObjectTarget): ReadonlyArray<string> =>
  (bindTarget({ state: useAppStore.getState(), target })?.resolve() ?? []).map((action) =>
    action.blockedReason === null ? action.id : `${action.id} (${action.blockedReason})`,
  );

const toasts: Array<string> = [];
const copies: Array<string> = [];

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast: ({ title, message }) => {
    toasts.push(title ?? message);
  },
  copyText: async ({ text }) => {
    copies.push(text);
  },
  origin: 'menu',
  anchorKey: null,
};

const run = (target: ObjectTarget, actionId: string, choice: string | null = null) =>
  runObjectAction({ target, actionId, env, choice });

const SESSION_TARGET: ObjectTarget = { kind: 'session', sessionId: SESSION };
const AGENT_TARGET: ObjectTarget = { kind: 'agent', sessionId: SESSION, agentId: AGENT };
const RUN_TARGET: ObjectTarget = { kind: 'workflowRun', sessionId: SESSION, runId: RUN };

const RUNNING: TurnState = {
  kind: 'running',
  runId: 'provider-run' as never,
  startedAt: FIXTURE_NOW,
};
const STARTING: TurnState = { kind: 'starting', startedAt: FIXTURE_NOW };

const SESSION_STATES: ReadonlyArray<readonly [string, ActionSeed | null, ReadonlyArray<string>]> = [
  [
    'draft',
    { session: sessionFixture({ goal: '' }) },
    [
      'session.open',
      'session.review',
      'session.diff (Add a project to this session first)',
      'session.terminal',
      'session.editor (This session has no worktree yet)',
      'session.rename',
      'session.startAgent',
      'session.linkIssue',
      'session.copyTitle',
      'session.archive',
      'session.delete',
    ],
  ],
  [
    'running',
    {
      agents: [agentFixture({ status: 'running' })],
      turnStates: { [AGENT]: RUNNING },
      mounts: [mountFixture()],
      branch: 'hl/payout-export',
    },
    [
      'session.open',
      'session.review',
      'session.diff',
      'session.terminal',
      'session.editor',
      'session.rename',
      'session.startAgent',
      'session.linkIssue',
      'session.copyTitle',
      'session.copyBranch',
      'session.archive',
      'session.delete',
    ],
  ],
  [
    'needs you, with a pull request',
    {
      agents: [agentFixture({ status: 'completed' })],
      questions: [questionFixture({ createdByAgentId: AGENT })],
      mounts: [mountFixture()],
      branch: 'hl/payout-export',
      prUrl: 'https://github.com/harborline/ledger-core/pull/482',
    },
    [
      'session.open',
      'session.review',
      'session.diff',
      'session.terminal',
      'session.editor',
      'session.rename',
      'session.startAgent',
      'session.linkIssue',
      'session.copyTitle',
      'session.copyBranch',
      'session.copyPr',
      'session.archive',
      'session.delete',
    ],
  ],
  [
    'archived',
    {
      session: sessionFixture({ archivedAt: FIXTURE_NOW }),
      isArchived: true,
      mounts: [mountFixture()],
      branch: 'hl/payout-export',
    },
    [
      'session.open',
      'session.restore',
      'session.copyTitle',
      'session.copyBranch',
      'session.delete',
    ],
  ],
  ['deleted', null, []],
];

describe('session menu in every state', () => {
  it.each(SESSION_STATES)('%s', (_state, value, expected) => {
    if (value !== null) {
      seed(value);
    }
    expect(matrixOf(SESSION_TARGET)).toEqual(expected);
  });

  it('confirms delete with the archive alternative, and none once archived', () => {
    seed({});
    const live = bindTarget({ state: useAppStore.getState(), target: SESSION_TARGET })?.resolve();
    expect(live?.find((action) => action.id === 'session.delete')?.confirm).toMatchObject({
      role: 'danger',
      altActionId: 'session.archive',
    });
    seed({ session: sessionFixture({ archivedAt: FIXTURE_NOW }), isArchived: true });
    const archived = bindTarget({
      state: useAppStore.getState(),
      target: SESSION_TARGET,
    })?.resolve();
    expect(archived?.find((action) => action.id === 'session.delete')?.confirm?.altActionId).toBe(
      undefined,
    );
  });

  it('names the branchless delete as final, files and all', () => {
    seed({ branch: '' });
    const action = bindTarget({ state: useAppStore.getState(), target: SESSION_TARGET })
      ?.resolve()
      .find((candidate) => candidate.id === 'session.delete');
    expect(action?.confirm?.description).toContain('every saved file version');
  });
});

describe('several sessions', () => {
  const PAIR = ['session-a', 'session-b'] as const;

  const seedPair = ({ archived }: { readonly archived: ReadonlyArray<string> }) => {
    const sessions = PAIR.map((id) =>
      sessionFixture({
        id: id as never,
        goal: `Northwind ${id}`,
        ...(archived.includes(id) && { archivedAt: FIXTURE_NOW }),
      }),
    );
    useAppStore.setState({
      sessions: sessions.filter((session) => session.archivedAt == null),
      archivedSessions: { [WORKSPACE]: sessions.filter((session) => session.archivedAt != null) },
    });
  };

  const labels = (): ReadonlyArray<string> =>
    (
      bindTarget({
        state: useAppStore.getState(),
        target: { kind: 'sessions', sessionIds: [...PAIR] as never },
      })?.resolve() ?? []
    ).map((action) => action.label);

  it('offers the bulk bar verbs on an active selection', () => {
    seedPair({ archived: [] });
    expect(labels()).toEqual(['Copy titles', 'Archive 2 sessions', 'Delete 2 sessions']);
  });

  it('offers restore on an archived selection', () => {
    seedPair({ archived: [...PAIR] });
    expect(labels()).toEqual(['Restore 2 sessions', 'Copy titles', 'Delete 2 sessions']);
  });

  it('splits a mixed selection by what each verb can touch', () => {
    seedPair({ archived: ['session-b'] });
    expect(labels()).toEqual([
      'Restore 1 session',
      'Copy titles',
      'Archive 1 session',
      'Delete 2 sessions',
    ]);
  });
});

const standalone = (value: Partial<ActionSeed> & { readonly status: string }): ActionSeed => ({
  agents: [agentFixture({ status: value.status as never, ...(value.agents?.[0] ?? {}) })],
  mounts: [mountFixture()],
  ...value,
});

const AGENT_STATES: ReadonlyArray<readonly [string, ActionSeed, ReadonlyArray<string>]> = [
  [
    'starting',
    standalone({ status: 'pending', turnStates: { [AGENT]: STARTING } }),
    [
      'agent.open',
      'agent.changes',
      'agent.message',
      'agent.model',
      'agent.copyName',
      'agent.delete',
    ],
  ],
  [
    'running',
    standalone({ status: 'running', turnStates: { [AGENT]: RUNNING } }),
    [
      'agent.open',
      'agent.changes',
      'agent.message',
      'agent.interrupt',
      'agent.model',
      'agent.copyName',
      'agent.delete',
    ],
  ],
  [
    'waiting on you',
    standalone({
      status: 'completed',
      questions: [questionFixture({ createdByAgentId: AGENT })],
    }),
    [
      'agent.open',
      'agent.changes',
      'agent.message',
      'agent.close',
      'agent.model',
      'agent.copyName',
      'agent.delete',
    ],
  ],
  [
    'stopped',
    standalone({ status: 'stopped' }),
    [
      'agent.open',
      'agent.changes',
      'agent.message',
      'agent.model',
      'agent.copyName',
      'agent.delete',
    ],
  ],
  [
    'failed',
    standalone({ status: 'failed' }),
    [
      'agent.open',
      'agent.changes',
      'agent.message',
      'agent.close',
      'agent.model',
      'agent.copyName',
      'agent.delete',
    ],
  ],
  [
    'done',
    standalone({ status: 'completed' }),
    [
      'agent.open',
      'agent.changes',
      'agent.message',
      'agent.model',
      'agent.copyName',
      'agent.delete',
    ],
  ],
  [
    'closed by you',
    { agents: [agentFixture({ status: 'failed', doneAt: FIXTURE_NOW })], mounts: [mountFixture()] },
    ['agent.open', 'agent.changes', 'agent.reopen', 'agent.copyName', 'agent.delete'],
  ],
  [
    'a running workflow step',
    {
      agents: [agentFixture({ status: 'running', workflowRunId: RUN })],
      turnStates: { [AGENT]: RUNNING },
      mounts: [mountFixture()],
    },
    [
      'agent.open',
      'agent.changes',
      'agent.message',
      'agent.interrupt',
      'agent.copyName',
      'agent.delete',
    ],
  ],
  [
    'in a session with no project',
    { agents: [agentFixture({ status: 'completed' })] },
    [
      'agent.open',
      'agent.changes (This session has no project yet)',
      'agent.message',
      'agent.model',
      'agent.copyName',
      'agent.delete',
    ],
  ],
];

describe('agent menu in every state', () => {
  it.each(AGENT_STATES)('%s', (_state, value, expected) => {
    seed(value);
    expect(matrixOf(AGENT_TARGET)).toEqual(expected);
  });

  it('offers the last reply once the agent answered', () => {
    seed(standalone({ status: 'completed' }));
    useAppStore.setState({
      transcripts: {
        [AGENT]: [
          { kind: 'user_text', text: 'Where does the export slow down?' } as never,
          { kind: 'assistant_text', delta: 'The ledger-core ', runId: 'r' } as never,
          { kind: 'assistant_text', delta: 'join is unindexed.', runId: 'r' } as never,
        ],
      },
    });
    expect(matrixOf(AGENT_TARGET)).toContain('agent.copyReply');
  });

  it('shows nothing for an agent that is gone', () => {
    seed({ agents: [agentFixture({ deletedAt: FIXTURE_NOW })] });
    expect(matrixOf(AGENT_TARGET)).toEqual([]);
  });

  it('lists the visible models of the agent provider with the current one checked', () => {
    seed(standalone({ status: 'completed' }));
    useAppStore.setState({ agentModelOverride: { [AGENT]: 'opus-5.5' } });
    const model = bindTarget({ state: useAppStore.getState(), target: AGENT_TARGET })
      ?.resolve()
      .find((action) => action.id === 'agent.model');
    expect(model?.choices?.find((choice) => choice.isCurrent)?.id).toBe('opus-5.5');
    expect(model?.choices?.length).toBeGreaterThan(1);
  });
});

const withRun = (value: {
  readonly run?: Parameters<typeof runFixture>[0];
  readonly agents?: ActionSeed['agents'];
  readonly questions?: ActionSeed['questions'];
  readonly turnStates?: ActionSeed['turnStates'];
}): ActionSeed => ({
  session: sessionFixture({ workflowRuns: [runFixture(value.run)] }),
  workflows: [workflowFixture()],
  agents: value.agents ?? [],
  questions: value.questions ?? [],
  turnStates: value.turnStates ?? {},
  mounts: [mountFixture()],
});

const RUN_STATES: ReadonlyArray<readonly [string, ActionSeed, ReadonlyArray<string>]> = [
  [
    'queued by hand',
    withRun({ run: { triggerMode: 'manual' } }),
    [
      'workflowRun.open',
      'workflowRun.diff',
      'workflowRun.start',
      'workflowRun.copySummary',
      'workflowRun.discard',
      'workflowRun.delete',
    ],
  ],
  [
    'running',
    withRun({
      agents: [stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'running' })],
      turnStates: { 'agent-plan': RUNNING },
    }),
    [
      'workflowRun.open',
      'workflowRun.diff',
      'workflowRun.copySummary',
      'workflowRun.close',
      'workflowRun.discard',
      'workflowRun.delete',
    ],
  ],
  [
    'paused before the next step',
    withRun({
      agents: [
        stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'completed' }),
        stepAgent({ id: 'agent-build', stepId: STEP_BUILD, status: 'pending' }),
      ],
    }),
    [
      'workflowRun.open',
      'workflowRun.diff',
      'workflowRun.nextStep',
      'workflowRun.copySummary',
      'workflowRun.close',
      'workflowRun.discard',
      'workflowRun.delete',
    ],
  ],
  [
    'paused on a stopped step',
    withRun({ agents: [stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'stopped' })] }),
    [
      'workflowRun.open',
      'workflowRun.diff',
      'workflowRun.continue',
      'workflowRun.copySummary',
      'workflowRun.close',
      'workflowRun.discard',
      'workflowRun.delete',
    ],
  ],
  [
    'waiting on a question',
    withRun({
      agents: [stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'completed' })],
      questions: [questionFixture({ workflowRunId: RUN })],
    }),
    [
      'workflowRun.open',
      'workflowRun.diff',
      'workflowRun.answer',
      'workflowRun.copySummary',
      'workflowRun.close',
      'workflowRun.discard',
      'workflowRun.delete',
    ],
  ],
  [
    'failed',
    withRun({ agents: [stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'failed' })] }),
    [
      'workflowRun.open',
      'workflowRun.diff',
      'workflowRun.restartStep',
      'workflowRun.copySummary',
      'workflowRun.close',
      'workflowRun.discard',
      'workflowRun.delete',
    ],
  ],
  [
    'done',
    withRun({
      agents: [
        stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'completed' }),
        stepAgent({ id: 'agent-build', stepId: STEP_BUILD, status: 'completed' }),
      ],
    }),
    [
      'workflowRun.open',
      'workflowRun.diff',
      'workflowRun.copySummary',
      'workflowRun.discard',
      'workflowRun.delete',
    ],
  ],
  [
    'discarded',
    withRun({ run: { discardedAt: FIXTURE_NOW } }),
    [
      'workflowRun.open',
      'workflowRun.diff',
      'workflowRun.restore',
      'workflowRun.copySummary',
      'workflowRun.delete',
    ],
  ],
];

describe('workflow run menu in every state', () => {
  it.each(RUN_STATES)('%s', (_state, value, expected) => {
    seed(value);
    expect(matrixOf(RUN_TARGET)).toEqual(expected);
  });
});

describe('plan part menu', () => {
  const part = (agentId: string | null, instructions: string): ObjectTarget => ({
    kind: 'planPart',
    sessionId: SESSION,
    planId: 'plan-payout' as never,
    index: 0,
    instructions,
    agentId: agentId as never,
  });

  it.each([
    [
      'not run yet',
      part(null, 'Index the ledger-core join'),
      ['planPart.open', 'planPart.copyInstructions'],
    ],
    [
      'running under its agent',
      part(AGENT, 'Index the ledger-core join'),
      ['planPart.open', 'planPart.agent', 'planPart.copyInstructions'],
    ],
    ['with no instructions', part(null, '  '), ['planPart.open']],
  ] as const)('%s', (_state, target, expected) => {
    expect(matrixOf(target)).toEqual(expected);
  });

  it('opens the part in the drawer', async () => {
    seed({});
    await run(part(null, 'Index'), 'planPart.open');
    expect(useAppStore.getState().drawer).toMatchObject({ kind: 'plan-part' });
  });
});

describe('actions run against the real store', () => {
  it('archives a session with an undo toast, and restores it', async () => {
    seed({});
    await run(SESSION_TARGET, 'session.archive');
    expect(useAppStore.getState().sessions.map((session) => session.id)).not.toContain(SESSION);
    expect(toasts).toContain('Session archived');
    seed({ session: sessionFixture({ archivedAt: FIXTURE_NOW }), isArchived: true });
    await run(SESSION_TARGET, 'session.restore');
    expect(
      (useAppStore.getState().archivedSessions[WORKSPACE] ?? []).map((session) => session.id),
    ).not.toContain(SESSION);
  });

  it('deletes a session', async () => {
    seed({});
    await run(SESSION_TARGET, 'session.delete');
    expect(useAppStore.getState().sessions).toEqual([]);
  });

  it('opens Review and Diff through the one door', async () => {
    seed({ mounts: [mountFixture()] });
    await run(SESSION_TARGET, 'session.review');
    expect(useAppStore.getState().activeLens[SESSION]).toBe('review');
    await run(SESSION_TARGET, 'session.diff');
    expect(useAppStore.getState().activeLens[SESSION]).toBe('files');
  });

  it('never runs a blocked verb', async () => {
    seed({});
    await run(SESSION_TARGET, 'session.diff');
    expect(useAppStore.getState().activeLens[SESSION]).toBeUndefined();
  });

  it('copies the branch name', async () => {
    seed({ mounts: [mountFixture()], branch: 'hl/payout-export' });
    copies.length = 0;
    await run(SESSION_TARGET, 'session.copyBranch');
    expect(copies).toEqual(['hl/payout-export']);
  });

  it('closes and reopens an agent', async () => {
    seed(standalone({ status: 'failed' }));
    await run(AGENT_TARGET, 'agent.close');
    const closed = useAppStore.getState().sessionPhaseRuns[SESSION]?.[0];
    expect(closed?.doneAt).not.toBeUndefined();
    await run(AGENT_TARGET, 'agent.reopen');
    expect(useAppStore.getState().sessionPhaseRuns[SESSION]?.[0]?.doneAt).toBeUndefined();
  });

  it('changes the model of an agent from the submenu', async () => {
    seed(standalone({ status: 'completed' }));
    await run(AGENT_TARGET, 'agent.model', 'sonnet-5');
    expect(useAppStore.getState().agentModelOverride[AGENT as AgentId]).toBe('sonnet-5');
  });

  it('deletes an agent', async () => {
    seed(standalone({ status: 'completed' }));
    await run(AGENT_TARGET, 'agent.delete');
    const left = (useAppStore.getState().sessionPhaseRuns[SESSION] ?? []).filter(
      (agent) => agent.deletedAt == null,
    );
    expect(left).toEqual([]);
  });

  it('discards a workflow run and restores it', async () => {
    seed(withRun({}));
    await run(RUN_TARGET, 'workflowRun.discard');
    const discarded = useAppStore
      .getState()
      .sessions[0]?.workflowRuns.find((candidate) => candidate.id === RUN);
    expect(discarded?.discardedAt).not.toBeUndefined();
    await run(RUN_TARGET, 'workflowRun.restore');
    const restored = useAppStore
      .getState()
      .sessions[0]?.workflowRuns.find((candidate) => candidate.id === RUN);
    expect(restored?.discardedAt).toBeUndefined();
  });

  it('archives several sessions at once', async () => {
    const sessions = ['session-a', 'session-b'].map((id) =>
      sessionFixture({ id: id as never, goal: `Acme ${id}` }),
    );
    useAppStore.setState({ sessions, archivedSessions: { [WORKSPACE]: [] } });
    await run(
      { kind: 'sessions', sessionIds: sessions.map((session) => session.id) },
      'sessions.archive',
    );
    expect(useAppStore.getState().sessions).toEqual([]);
    expect(toasts).toContain('2 sessions archived');
  });
});
