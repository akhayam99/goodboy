// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => bridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('../../features/actions/dispatchAfterNavigation', () => ({
  dispatchAfterNavigation: ({
    name,
    detail,
  }: {
    readonly name: string;
    readonly detail?: unknown;
  }) => window.dispatchEvent(new CustomEvent(name, { detail })),
}));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentId,
  MountId,
  SessionProjectMount,
  TurnState,
  WorktreeStatus,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { bindTarget, runObjectAction } from '../../features/actions/registry';
import {
  SESSION_ID as REVIEW_SESSION,
  seedResolveScene,
} from '../../app/components/MockScene/scenes/resolveSeed';
import { ALL_CHOICES_ID, type ActionEnv, type ObjectTarget } from '../../features/actions/types';
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
  viewing: null,
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
      'session.copyWorktreePath',
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
      'session.copyWorktreePath',
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
      'session.copyWorktreePath',
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

  it('copies the only worktree path straight away, with no choices', async () => {
    seed({ mounts: [mountFixture()] });
    const action = bindTarget({ state: useAppStore.getState(), target: SESSION_TARGET })
      ?.resolve()
      .find((candidate) => candidate.id === 'session.copyWorktreePath');
    expect(action?.choices).toEqual([]);
    copies.length = 0;
    await run(SESSION_TARGET, 'session.copyWorktreePath');
    expect(copies).toEqual([mountFixture().worktreePath]);
  });

  it('offers every worktree and all of them at once when there are several', async () => {
    const second = mountFixture({
      mountId: 'mount-notify-relay' as MountId,
      mountName: 'notify-relay',
      worktreePath: '/worktrees/notify-relay',
      branch: 'hl/payout-webhook',
    });
    seed({ mounts: [mountFixture(), second] });
    const action = bindTarget({ state: useAppStore.getState(), target: SESSION_TARGET })
      ?.resolve()
      .find((candidate) => candidate.id === 'session.copyWorktreePath');
    expect(action?.choices?.map((choice) => choice.label)).toEqual([
      mountFixture().mountName,
      'notify-relay',
      'Copy all paths',
    ]);
    copies.length = 0;
    await run(SESSION_TARGET, 'session.copyWorktreePath', 'mount-notify-relay');
    await run(SESSION_TARGET, 'session.copyWorktreePath', ALL_CHOICES_ID);
    expect(copies).toEqual([
      '/worktrees/notify-relay',
      `${mountFixture().worktreePath}\n/worktrees/notify-relay`,
    ]);
  });

  it('names what a branchless delete frees and what stays in Impact', () => {
    seed({ branch: '' });
    const action = bindTarget({ state: useAppStore.getState(), target: SESSION_TARGET })
      ?.resolve()
      .find((candidate) => candidate.id === 'session.delete');
    expect(action?.confirm?.description).toBe(
      'Frees the transcript, file versions and images. Cost and shipped work stay in Impact. This cannot be undone.',
    );
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

const storedArtifact = (fields: {
  readonly kind: 'plan' | 'report' | 'wireframe';
  readonly status?: string;
}) =>
  ({
    id: 'artifact-payout',
    sessionId: SESSION,
    agentId: AGENT,
    workflowRunId: null,
    kind: fields.kind,
    schemaVersion: 1,
    title: 'Speed up the payout export',
    sourceFormat: fields.kind === 'wireframe' ? 'json' : 'markdown',
    sourceText: '# Speed up the payout export',
    metadata: fields.kind === 'report' ? { reportType: 'session-summary' } : {},
    status: fields.status ?? 'active',
    revision: 1,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
  }) as never;

const storedTarget = ({ isPlanRunning = false } = {}): ObjectTarget => ({
  kind: 'artifact',
  sessionId: SESSION,
  subject: { kind: 'stored', artifactId: 'artifact-payout' as never, isPlanRunning },
});

describe('artifact menu on the real store', () => {
  it('shows nothing for an artifact that is gone', () => {
    seed({});
    expect(matrixOf(storedTarget())).toEqual([]);
  });

  it('copies the source of a stored artifact', async () => {
    seed({});
    useAppStore.setState({ sessionArtifacts: { [SESSION]: [storedArtifact({ kind: 'report' })] } });
    copies.length = 0;
    await run(storedTarget(), 'artifact.copySource');
    expect(copies).toEqual(['# Speed up the payout export']);
  });
});

const slottedOf = (target: ObjectTarget): ReadonlyArray<string> =>
  (bindTarget({ state: useAppStore.getState(), target })?.resolve() ?? []).map((action) =>
    action.blockedReason === null
      ? `${action.id} ${action.slot}`
      : `${action.id} ${action.slot} (${action.blockedReason})`,
  );

const PR_TARGET: ObjectTarget = { kind: 'pullRequest', sessionId: SESSION, prNumber: null };

const seedPullRequest = (
  fields: Partial<{
    state: 'open' | 'merged' | 'closed' | 'queued';
    isDraft: boolean;
    checks: 'success' | 'failure' | 'pending' | null;
    reviewDecision: 'approved' | 'changes_requested' | 'review_required' | null;
    mergeable: boolean | null;
    author: string;
    openThreads: number;
  }> | null,
): void => {
  seed({});
  if (fields === null) {
    useAppStore.setState({
      sessionGithub: { [SESSION]: { pr: null, detail: null } as never },
    });
    return;
  }
  const comments = Array.from({ length: fields.openThreads ?? 0 }, (_, index) => ({
    id: `c-${index}`,
    author: 'kenji-w',
    authorAvatarUrl: null,
    body: 'Cap the retries',
    createdAt: FIXTURE_NOW,
    url: `https://github.com/harborline/ledger-core/pull/482#discussion_${index}`,
    source: 'review',
    resolved: false,
    threadId: `PRRT_${index}`,
    path: 'src/payout.ts',
    line: 10 + index,
  }));
  useAppStore.setState({
    githubStatus: { mode: 'gh-cli', available: true, user: 'mara-l' },
    sessionGithub: {
      [SESSION]: {
        pr: {
          number: 482,
          title: 'Export payouts in one pass',
          url: 'https://github.com/harborline/ledger-core/pull/482',
          state: fields.state ?? 'open',
          mergeable: fields.mergeable ?? true,
          checks: fields.checks ?? 'success',
          baseBranch: 'main',
          headBranch: 'hl/payout-export',
          isDraft: fields.isDraft ?? false,
          reviewDecision: fields.reviewDecision ?? null,
          body: '',
          updatedAt: FIXTURE_NOW,
          author: fields.author ?? 'mara-l',
        },
        detail: {
          prNumber: 482,
          comments,
          reviews:
            fields.reviewDecision === 'changes_requested'
              ? [
                  {
                    id: 'r-1',
                    author: 'kenji-w',
                    authorAvatarUrl: null,
                    state: 'changes_requested',
                    submittedAt: FIXTURE_NOW,
                    body: '',
                  },
                ]
              : [],
          reviewRequests: [],
          checks:
            fields.checks === 'failure'
              ? [{ name: 'unit tests', conclusion: 'failure', detailsUrl: null, durationMs: 1 }]
              : [],
        },
      } as never,
    },
  });
};

const PR_OWN_TAIL = ['pullRequest.editDetails hover', 'pullRequest.requestReview section'];
const PR_COPIES = ['pullRequest.copyLink menu', 'pullRequest.copyBranch menu'];

const UX5_PR_STATES: ReadonlyArray<
  readonly [string, Parameters<typeof seedPullRequest>[0], ReadonlyArray<string>]
> = [
  [
    'draft',
    { isDraft: true },
    [
      'pullRequest.openOnGithub secondary',
      'pullRequest.checkLog hover',
      'pullRequest.markReady primary',
      ...PR_OWN_TAIL,
      ...PR_COPIES,
      'pullRequest.close menu',
    ],
  ],
  [
    'checks running',
    { checks: 'pending', reviewDecision: 'review_required' },
    [
      'pullRequest.openOnGithub secondary',
      'pullRequest.checkLog hover',
      'pullRequest.merge secondary (Checks are still running.)',
      ...PR_OWN_TAIL,
      'pullRequest.convertToDraft menu',
      ...PR_COPIES,
      'pullRequest.close menu',
    ],
  ],
  [
    'checks failing',
    { checks: 'failure', reviewDecision: 'changes_requested', openThreads: 3 },
    [
      'pullRequest.openOnGithub secondary',
      'pullRequest.checkLog hover',
      'pullRequest.merge secondary (1 check failing: unit tests.)',
      ...PR_OWN_TAIL,
      'pullRequest.convertToDraft menu',
      ...PR_COPIES,
      'pullRequest.close menu',
    ],
  ],
  [
    'changes requested',
    { reviewDecision: 'changes_requested', openThreads: 3 },
    [
      'pullRequest.openOnGithub secondary',
      'pullRequest.checkLog hover',
      'pullRequest.merge secondary (kenji-w asked for changes.)',
      ...PR_OWN_TAIL,
      'pullRequest.convertToDraft menu',
      ...PR_COPIES,
      'pullRequest.close menu',
    ],
  ],
  [
    'approved, green',
    { reviewDecision: 'approved' },
    [
      'pullRequest.openOnGithub secondary',
      'pullRequest.checkLog hover',
      'pullRequest.merge primary',
      ...PR_OWN_TAIL,
      'pullRequest.convertToDraft menu',
      ...PR_COPIES,
      'pullRequest.close menu',
    ],
  ],
  [
    'conflicts with main',
    { reviewDecision: 'approved', mergeable: false },
    [
      'pullRequest.openOnGithub secondary',
      'pullRequest.checkLog hover',
      'pullRequest.merge secondary (Conflicts with main. Rebase in the Diff.)',
      ...PR_OWN_TAIL,
      'pullRequest.convertToDraft menu',
      ...PR_COPIES,
      'pullRequest.close menu',
    ],
  ],
  ['merged', { state: 'merged' }, ['pullRequest.openOnGithub secondary', ...PR_COPIES]],
  [
    'closed',
    { state: 'closed' },
    ['pullRequest.openOnGithub secondary', 'pullRequest.reopen secondary', ...PR_COPIES],
  ],
  [
    "someone else's",
    { reviewDecision: 'review_required', author: 'kenji-w' },
    [
      'pullRequest.openOnGithub secondary',
      'pullRequest.checkLog hover',
      'pullRequest.merge secondary (Needs an approving review.)',
      'pullRequest.writeReview secondary',
      ...PR_COPIES,
    ],
  ],
  ['no pull request yet', null, ['pullRequest.create primary']],
];

describe('pull request actions in every state, on the real store', () => {
  it.each(UX5_PR_STATES)('%s', (_state, fields, expected) => {
    seedPullRequest(fields);
    expect(slottedOf(PR_TARGET)).toEqual(expected);
  });
});

const LEDGER_MOUNT = mountFixture();

const gitStatus = (
  fields: Partial<{
    ahead: number;
    behind: number;
    unpushed: number;
    originAhead: number;
    changed: number;
    rebase: boolean;
    upstream: string | null;
  }>,
): WorktreeStatus => ({
  branch: LEDGER_MOUNT.branch,
  head: null,
  headSubject: null,
  upstream: fields.upstream === undefined ? 'origin/hl/payout-export' : fields.upstream,
  mainDistance: { kind: 'known', ahead: fields.ahead ?? 5, behind: fields.behind ?? 0 },
  upstreamDistance: {
    kind: 'known',
    ahead: fields.unpushed ?? 0,
    behind: fields.originAhead ?? 0,
  },
  workingTree: {
    kind: 'known',
    staged: 0,
    unstaged: fields.changed ?? 0,
    untracked: 0,
    unmerged: 0,
    changed: fields.changed ?? 0,
  },
  inProgress: fields.rebase === true ? 'rebase' : null,
});

const seedMount = ({
  pr,
  isAttached = true,
  mounts = [LEDGER_MOUNT],
  openThreads = 0,
}: {
  readonly pr: 'open' | 'draft' | 'merged' | 'closed' | null;
  readonly isAttached?: boolean;
  readonly mounts?: ReadonlyArray<SessionProjectMount>;
  readonly openThreads?: number;
}): void => {
  seed({ mounts });
  useAppStore.setState({
    projects: [
      {
        id: LEDGER_MOUNT.projectId,
        name: 'ledger-core',
        kind: 'repo',
        baseBranch: 'main',
        rootPath: LEDGER_MOUNT.repoRoot,
      } as never,
    ],
    sessionMounts: {
      [SESSION]: mounts.map((mount) => ({
        id: mount.mountId ?? LEDGER_MOUNT.mountId,
        sessionId: SESSION,
        projectId: mount.projectId,
        worktreePath: isAttached || mount !== LEDGER_MOUNT ? mount.worktreePath : null,
        lastWorktreePath: mount.worktreePath,
        branch: mount.branch,
        baseBranch: mount.baseBranch ?? null,
        parallelIndex: mount.parallelIndex ?? 0,
        mountName: mount.mountName,
        repoSlug: null,
        repoRoot: mount.repoRoot,
        isAttached: isAttached || mount !== LEDGER_MOUNT,
        diskState: 'present',
        revision: 1,
        createdAt: FIXTURE_NOW,
        updatedAt: FIXTURE_NOW,
      })) as never,
    },
    mountGithub:
      pr === null
        ? {}
        : ({
            [LEDGER_MOUNT.mountId as string]: {
              pr: {
                number: 482,
                title: 'Export payouts in one pass',
                url: 'https://github.com/harborline/ledger-core/pull/482',
                state: pr === 'draft' ? 'open' : pr,
                isDraft: pr === 'draft',
                headSha: null,
              },
              repository: null,
              host: null,
              detail: {
                prNumber: 482,
                comments: Array.from({ length: openThreads }, (_, index) => ({
                  id: `c-${index}`,
                  author: 'kenji-w',
                  authorAvatarUrl: null,
                  body: 'Cap the retries',
                  createdAt: FIXTURE_NOW,
                  url: `https://github.com/harborline/ledger-core/pull/482#discussion_${index}`,
                  source: 'review',
                  resolved: false,
                  threadId: `PRRT_${index}`,
                })),
                reviews: [],
                reviewRequests: [],
                checks: [],
              },
            },
          } as never),
  });
};

const mountRowTarget = (status: WorktreeStatus | null): ObjectTarget => ({
  kind: 'mount',
  sessionId: SESSION,
  mountId: LEDGER_MOUNT.mountId as MountId,
  status,
  remoteKind: 'github',
});

const WT_TOOLS = ['mount.openTerminal menu', 'mount.openInEditor menu', 'mount.scripts menu'];
const WT_COPIES = ['mount.copyBranch menu', 'mount.copyPath menu'];
const WT_HISTORY = [
  'mount.rewriteHistory menu',
  'mount.switchBranch chip',
  'mount.putTaskOnBranch chip',
];
const WT_PR = ['mount.openPullRequest inline', 'mount.openDiff inline'];

const MOUNT_STATES: ReadonlyArray<
  readonly [string, Parameters<typeof seedMount>[0], WorktreeStatus | null, ReadonlyArray<string>]
> = [
  [
    'PR open, 3 to resolve',
    { pr: 'open', openThreads: 3 },
    gitStatus({}),
    [
      ...WT_PR,
      'mount.openReview inline',
      ...WT_TOOLS,
      ...WT_HISTORY,
      ...WT_COPIES,
      'mount.close menu',
    ],
  ],
  [
    'no PR, not pushed',
    { pr: null },
    gitStatus({ ahead: 3, upstream: null }),
    [
      'mount.openDiff inline',
      ...WT_TOOLS,
      'mount.createPullRequest inline',
      ...WT_HISTORY,
      ...WT_COPIES,
      'mount.close menu',
    ],
  ],
  [
    'no PR, pushed',
    { pr: null },
    gitStatus({ ahead: 3 }),
    [
      'mount.openDiff inline',
      ...WT_TOOLS,
      'mount.createPullRequest inline',
      ...WT_HISTORY,
      ...WT_COPIES,
      'mount.close menu',
    ],
  ],
  [
    'draft PR',
    { pr: 'draft' },
    gitStatus({ ahead: 4 }),
    [...WT_PR, ...WT_TOOLS, ...WT_HISTORY, ...WT_COPIES, 'mount.close menu'],
  ],
  [
    'PR open, 2 not pushed',
    { pr: 'open' },
    gitStatus({ ahead: 6, unpushed: 2 }),
    [...WT_PR, ...WT_TOOLS, 'mount.push inline', ...WT_HISTORY, ...WT_COPIES, 'mount.close menu'],
  ],
  [
    'behind main by 4',
    { pr: 'open' },
    gitStatus({ behind: 4 }),
    [...WT_PR, ...WT_TOOLS, 'mount.rebase inline', ...WT_HISTORY, ...WT_COPIES, 'mount.close menu'],
  ],
  [
    'behind, 2 uncommitted',
    { pr: 'open' },
    gitStatus({ behind: 4, changed: 2 }),
    [
      ...WT_PR,
      ...WT_TOOLS,
      'mount.rebase inline (Commit or discard the 2 uncommitted changes first.)',
      'mount.rewriteHistory menu (Commit or discard the 2 uncommitted changes first.)',
      'mount.switchBranch chip (The 2 uncommitted changes would follow you. Commit or discard them first.)',
      'mount.putTaskOnBranch chip',
      ...WT_COPIES,
      'mount.close menu',
    ],
  ],
  [
    'diverged from origin',
    { pr: 'open' },
    gitStatus({ unpushed: 1, originAhead: 1 }),
    [
      ...WT_PR,
      ...WT_TOOLS,
      'mount.push menu (Origin has a commit this branch lacks. Rebase on it first; Rewrite history owns force pushes.)',
      ...WT_HISTORY,
      ...WT_COPIES,
      'mount.close menu',
    ],
  ],
  [
    'rebase stopped',
    { pr: 'open' },
    gitStatus({ changed: 3, rebase: true }),
    [
      ...WT_PR,
      'mount.openTerminal notice',
      'mount.openInEditor menu',
      'mount.scripts menu',
      'mount.abortRebase notice',
      'mount.rewriteHistory menu (Finish or abort the rebase first.)',
      'mount.putTaskOnBranch chip',
      ...WT_COPIES,
    ],
  ],
  [
    'merged',
    { pr: 'merged' },
    gitStatus({ ahead: 0 }),
    [
      'mount.openPullRequest inline',
      ...WT_TOOLS,
      'mount.switchBranch chip',
      'mount.putTaskOnBranch chip',
      ...WT_COPIES,
      'mount.close inline',
    ],
  ],
  [
    'PR closed',
    { pr: 'closed' },
    gitStatus({}),
    [...WT_PR, ...WT_TOOLS, ...WT_HISTORY, ...WT_COPIES, 'mount.close menu'],
  ],
  [
    'new branch, no changes, one of two mounts',
    {
      pr: null,
      mounts: [
        LEDGER_MOUNT,
        mountFixture({
          mountId: 'mount-ledger-core-2' as MountId,
          worktreePath: '/work/harborline/ledger-core-2',
          branch: 'hl/payout-docs',
        }),
      ],
    },
    gitStatus({ ahead: 0 }),
    [
      ...WT_TOOLS,
      'mount.switchBranch chip',
      'mount.putTaskOnBranch chip',
      'mount.startTurnsHere menu',
      ...WT_COPIES,
      'mount.close menu',
    ],
  ],
  [
    'worktree closed, files kept',
    { pr: 'open', isAttached: false },
    null,
    ['mount.reopen inline', ...WT_COPIES, 'mount.forget menu'],
  ],
];

describe('worktree row actions in every state, on the real store', () => {
  it.each(MOUNT_STATES)('%s', (_state, mountSeed, status, expected) => {
    seedMount(mountSeed);
    if (_state.startsWith('new branch')) {
      useAppStore.setState({ sessionActiveMount: { [SESSION]: 'mount-ledger-core-2' as MountId } });
    }
    expect(slottedOf(mountRowTarget(status))).toEqual(expected);
  });
});

describe('project actions, on the real store', () => {
  it('offers Remove from session while the project has a mount', () => {
    seedMount({ pr: null });
    expect(
      slottedOf({ kind: 'project', sessionId: SESSION, projectId: LEDGER_MOUNT.projectId }),
    ).toEqual(['project.detach menu']);
  });

  it('offers nothing once the project has no mount', () => {
    seedMount({ pr: null, mounts: [] });
    expect(
      slottedOf({ kind: 'project', sessionId: SESSION, projectId: LEDGER_MOUNT.projectId }),
    ).toEqual([]);
  });
});

const diffTarget = (status: WorktreeStatus | null, patch = 'diff --git a/x b/x'): ObjectTarget => ({
  kind: 'diff',
  sessionId: SESSION,
  worktreePath: LEDGER_MOUNT.worktreePath,
  status,
  remoteKind: 'github',
  patch,
  rebaseConflicts: 0,
});

const DIFF_TOOLS = ['diff.openTerminal menu', 'diff.openInEditor menu'];
const DIFF_COPIES = ['diff.copyBranch menu', 'diff.copyPatch menu'];
const DIFF_TAIL = ['diff.changeBase menu', 'diff.restoreBackup menu', ...DIFF_COPIES];

const DIFF_STATES: ReadonlyArray<
  readonly [string, 'open' | null, WorktreeStatus, ReadonlyArray<string>]
> = [
  [
    'on origin, PR open',
    'open',
    gitStatus({}),
    [...DIFF_TOOLS, 'diff.rewriteHistory secondary', ...DIFF_TAIL],
  ],
  [
    '3 not pushed, no PR',
    null,
    gitStatus({ ahead: 3, upstream: null }),
    [
      ...DIFF_TOOLS,
      'diff.createPullRequest primary',
      'diff.rewriteHistory secondary',
      ...DIFF_TAIL,
    ],
  ],
  [
    '2 not pushed, PR open',
    'open',
    gitStatus({ ahead: 6, unpushed: 2 }),
    [...DIFF_TOOLS, 'diff.push primary', 'diff.rewriteHistory secondary', ...DIFF_TAIL],
  ],
  [
    'behind main by 4',
    'open',
    gitStatus({ behind: 4 }),
    [...DIFF_TOOLS, 'diff.rebase primary', 'diff.rewriteHistory secondary', ...DIFF_TAIL],
  ],
  [
    '2 uncommitted',
    'open',
    gitStatus({ behind: 4, changed: 2 }),
    [
      ...DIFF_TOOLS,
      'diff.rebase primary (Commit or discard the 2 uncommitted changes first.)',
      'diff.rewriteHistory secondary (Commit or discard the 2 uncommitted changes first.)',
      'diff.changeBase menu',
      'diff.restoreBackup menu (Commit or discard the 2 uncommitted changes first.)',
      ...DIFF_COPIES,
    ],
  ],
  [
    'diverged',
    'open',
    gitStatus({ unpushed: 1, originAhead: 1 }),
    [
      ...DIFF_TOOLS,
      'diff.push menu (Origin has a commit this branch lacks. Rebase on it first; Rewrite history owns force pushes.)',
      'diff.rewriteHistory secondary',
      ...DIFF_TAIL,
    ],
  ],
  [
    'rebase stopped',
    'open',
    gitStatus({ changed: 3, rebase: true }),
    [
      'diff.continueRebase primary',
      'diff.openInEditor menu',
      'diff.abortRebase secondary',
      'diff.rewriteHistory secondary (Finish or abort the rebase first.)',
      'diff.restoreBackup menu (Commit or discard the 3 uncommitted changes first.)',
      ...DIFF_COPIES,
    ],
  ],
  [
    'no changes',
    null,
    gitStatus({ ahead: 0 }),
    [...DIFF_TOOLS, 'diff.changeBase menu', 'diff.copyBranch menu'],
  ],
];

describe('diff actions in every state, on the real store', () => {
  it.each(DIFF_STATES)('%s', (state, pr, status, expected) => {
    seedMount({ pr });
    expect(
      slottedOf(diffTarget(status, state === 'no changes' ? '' : 'diff --git a/x b/x')),
    ).toEqual(expected);
  });
});

const record = (
  fields: Partial<{ sessionId: string | null; isStarred: boolean | null; url: string }>,
): ObjectTarget => ({
  kind: 'record',
  facts: {
    identifier: 'HAR-231',
    title: 'Payout export times out for Northwind',
    url: fields.url ?? 'https://linear.app/harborline/issue/HAR-231',
    providerLabel: 'Linear',
    sessionId: (fields.sessionId ?? null) as never,
    isStarred: fields.isStarred === undefined ? false : fields.isStarred,
    onOpen: () => undefined,
    onLaunch: () => undefined,
    onToggleStar: () => undefined,
    onRefresh: null,
    verbs: [],
    sessionVerbs: [],
    destructive: [],
  },
});

describe('inbox record menu in every state', () => {
  it.each([
    [
      'new, not starred',
      record({}),
      [
        'record.open',
        'record.openInProvider',
        'record.launch',
        'record.star',
        'record.copyLink',
        'record.copyKey',
      ],
    ],
    [
      'linked to a session, starred',
      record({ sessionId: SESSION, isStarred: true }),
      [
        'record.open',
        'record.openSession',
        'record.openInProvider',
        'record.star',
        'record.copyLink',
        'record.copyKey',
      ],
    ],
    [
      'with no link in its tool',
      record({ url: '' }),
      ['record.open', 'record.launch', 'record.star', 'record.copyKey'],
    ],
  ] as const)('%s', (_state, target, expected) => {
    expect(matrixOf(target)).toEqual(expected);
  });

  it('labels the star by its state', () => {
    const labels = (target: ObjectTarget) =>
      (bindTarget({ state: useAppStore.getState(), target })?.resolve() ?? []).map(
        (action) => action.label,
      );
    expect(labels(record({ isStarred: true }))).toContain('Unstar');
    expect(labels(record({ isStarred: false }))).toContain('Star');
  });
});

const noop = () => undefined;

const commitTarget = (fields: {
  readonly isFolded?: boolean;
  readonly isRemoved?: boolean;
  readonly canRemove?: boolean;
  readonly canFoldDown?: boolean;
}): ObjectTarget => ({
  kind: 'commit',
  facts: {
    sha: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1',
    shortSha: 'b2c3d4e',
    subject: 'Keep trailing-comma rows in the ledger-core importer',
    isFolded: fields.isFolded ?? false,
    isRemoved: fields.isRemoved ?? false,
    canRemove: fields.canRemove ?? true,
    canFoldDown: fields.canFoldDown ?? true,
    onRename: noop,
    onFoldDown: noop,
    onSquashDown: noop,
    onToggleRemove: noop,
    onSeparate: noop,
    onMove: noop,
  },
});

const worktreeTarget = (fields: {
  readonly isInUse: boolean;
  readonly isKept: boolean;
  readonly removeIntent: 'force' | 'untracked' | null;
}): ObjectTarget => ({
  kind: 'worktree',
  facts: {
    path: '/work/.goodboy/worktrees/notify-relay-backoff',
    ...fields,
    onReveal: noop,
    onEditor: noop,
    onKeep: noop,
    onStopKeeping: noop,
    onRemove: noop,
  },
});

const scriptTarget = (fields: {
  readonly isSaved: boolean;
  readonly isRunning: boolean;
  readonly blocked?: string | null;
}): ObjectTarget => ({
  kind: 'script',
  facts: {
    name: 'dev',
    command: 'pnpm --filter @harborline/ledger-core run dev',
    isRunning: fields.isRunning,
    runBlockedReason: fields.blocked ?? null,
    onShowOutput: noop,
    onRun: noop,
    onStop: noop,
    onEdit: fields.isSaved ? noop : null,
    onDuplicate: fields.isSaved ? noop : null,
    onSaveAs: fields.isSaved ? null : noop,
    onDelete: fields.isSaved ? async () => undefined : null,
  },
});

const GIT_STATES: ReadonlyArray<readonly [string, ObjectTarget, ReadonlyArray<string>]> = [
  [
    'commit with one below',
    commitTarget({}),
    [
      'commit.rename',
      'commit.foldDown',
      'commit.squashDown',
      'commit.moveUp',
      'commit.moveDown',
      'commit.copySha',
      'commit.copySubject',
      'commit.remove',
    ],
  ],
  [
    'oldest commit that takes others in',
    commitTarget({ canFoldDown: false, canRemove: false }),
    [
      'commit.rename',
      'commit.foldDown (Nothing below to combine with)',
      'commit.squashDown (Nothing below to combine with)',
      'commit.moveUp',
      'commit.moveDown',
      'commit.copySha',
      'commit.copySubject',
      'commit.remove (Separate what it takes in first)',
    ],
  ],
  [
    'commit folded into another',
    commitTarget({ isFolded: true }),
    ['commit.separate', 'commit.copySha', 'commit.copySubject'],
  ],
  [
    'removed commit',
    commitTarget({ isRemoved: true }),
    [
      'commit.rename',
      'commit.foldDown',
      'commit.squashDown',
      'commit.moveUp',
      'commit.moveDown',
      'commit.keep',
      'commit.copySha',
      'commit.copySubject',
    ],
  ],
  [
    'diff file in the Diff lens',
    {
      kind: 'diffFile',
      facts: { path: 'src/importer.ts', onOpenInEditor: noop, onCommentOnFile: noop },
    },
    ['diffFile.openInEditor', 'diffFile.comment', 'diffFile.copyPath'],
  ],
  [
    'diff file in the drawer',
    {
      kind: 'diffFile',
      facts: { path: 'src/importer.ts', onOpenInEditor: null, onCommentOnFile: null },
    },
    ['diffFile.copyPath'],
  ],
  [
    'worktree clean, idle',
    worktreeTarget({ isInUse: false, isKept: false, removeIntent: null }),
    [
      'worktree.reveal',
      'worktree.editor',
      'worktree.keepDays',
      'worktree.keep',
      'worktree.copyPath',
    ],
  ],
  [
    'worktree dirty',
    worktreeTarget({ isInUse: false, isKept: false, removeIntent: 'force' }),
    [
      'worktree.reveal',
      'worktree.editor',
      'worktree.keepDays',
      'worktree.keep',
      'worktree.copyPath',
      'worktree.remove',
    ],
  ],
  [
    'worktree kept, not tracked by git',
    worktreeTarget({ isInUse: false, isKept: true, removeIntent: 'untracked' }),
    [
      'worktree.reveal',
      'worktree.editor',
      'worktree.stopKeeping',
      'worktree.copyPath',
      'worktree.remove',
    ],
  ],
  [
    'worktree in use by a session',
    worktreeTarget({ isInUse: true, isKept: false, removeIntent: null }),
    ['worktree.reveal', 'worktree.editor', 'worktree.copyPath'],
  ],
  [
    'saved script, idle',
    scriptTarget({ isSaved: true, isRunning: false }),
    [
      'script.output',
      'script.run',
      'script.edit',
      'script.duplicate',
      'script.copyCommand',
      'script.delete',
    ],
  ],
  [
    'package script, running',
    scriptTarget({ isSaved: false, isRunning: true }),
    ['script.output', 'script.stop', 'script.saveAs', 'script.copyCommand'],
  ],
  [
    'package script while its project prepares',
    scriptTarget({ isSaved: false, isRunning: false, blocked: 'ledger-core is still preparing' }),
    [
      'script.output',
      'script.run (ledger-core is still preparing)',
      'script.saveAs',
      'script.copyCommand',
    ],
  ],
];

describe('git surface menus in every state', () => {
  it.each(GIT_STATES)('%s', (_state, target, expected) => {
    expect(matrixOf(target)).toEqual(expected);
  });

  it('squashes into the one below and moves one place older', async () => {
    const onSquashDown = vi.fn();
    const onMove = vi.fn();
    const target = commitTarget({});
    if (target.kind !== 'commit') {
      throw new Error('expected a commit');
    }
    const wired = { ...target, facts: { ...target.facts, onSquashDown, onMove } };
    await run(wired, 'commit.squashDown', null);
    await run(wired, 'commit.moveDown', null);
    expect(onSquashDown).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith('older');
  });
});

describe('transcript message menu', () => {
  const message = (fields: {
    readonly agentId: string | null;
    readonly text: string;
  }): ObjectTarget => ({
    kind: 'message',
    text: fields.text,
    sessionId: SESSION,
    agentId: fields.agentId as never,
  });

  it('offers open, quote and both copies on a message of a live agent', () => {
    seed(standalone({ status: 'completed' }));
    expect(
      matrixOf(message({ agentId: AGENT, text: 'The **ledger-core** join is unindexed.' })),
    ).toEqual(['message.openAgent', 'message.quote', 'message.copy', 'message.copyMarkdown']);
  });

  it('offers only the copies when no agent can take a reply', () => {
    seed({});
    expect(matrixOf(message({ agentId: null, text: 'Northwind asked for half even.' }))).toEqual([
      'message.copy',
      'message.copyMarkdown',
    ]);
  });

  it('copies plain text or the markdown source, and quotes into the draft', async () => {
    seed(standalone({ status: 'completed' }));
    copies.length = 0;
    const target = message({ agentId: AGENT, text: 'The **ledger-core** join is `unindexed`.' });
    await run(target, 'message.copy');
    await run(target, 'message.copyMarkdown');
    expect(copies).toEqual([
      'The ledger-core join is unindexed.',
      'The **ledger-core** join is `unindexed`.',
    ]);
    await run(target, 'message.quote');
    expect(useAppStore.getState().agentDraft[AGENT]).toBe(
      '> The **ledger-core** join is `unindexed`.\n\n',
    );
  });
});

const COMMENT_OPEN = [
  'reviewComment.openInDiff',
  'reviewComment.transcript',
  'reviewComment.openOnGithub',
];
const COMMENT_DECIDE = [
  'reviewComment.reply',
  'reviewComment.skip',
  'reviewComment.resolveNoReply',
];

const REVIEW_COMMENT_STATES: ReadonlyArray<readonly [string, string, ReadonlyArray<string>]> = [
  [
    'not started',
    'PRRT_thread_retry_constant',
    [
      'reviewComment.openInDiff',
      'reviewComment.openOnGithub',
      'reviewComment.draft',
      ...COMMENT_DECIDE,
      'reviewComment.copyLink',
    ],
  ],
  [
    'drafting',
    'PRRT_thread_idempotency',
    [...COMMENT_OPEN, 'reviewComment.stop', 'reviewComment.copyLink'],
  ],
  [
    'needs you',
    'PRRT_thread_error_shape',
    [...COMMENT_OPEN, 'reviewComment.answer', ...COMMENT_DECIDE, 'reviewComment.copyLink'],
  ],
  [
    'ready',
    'PRRT_thread_retry_backoff',
    [
      ...COMMENT_OPEN,
      'reviewComment.accept',
      'reviewComment.edit',
      'reviewComment.editReply',
      ...COMMENT_DECIDE,
      'reviewComment.copyLink',
    ],
  ],
  [
    'accepted',
    'PRRT_thread_log_redact',
    [
      'reviewComment.openInDiff',
      'reviewComment.openOnGithub',
      'reviewComment.undo',
      'reviewComment.copyLink',
    ],
  ],
  [
    'skipped',
    'PRRT_thread_flaky_test',
    [
      'reviewComment.openInDiff',
      'reviewComment.openOnGithub',
      'reviewComment.undo',
      'reviewComment.copyLink',
    ],
  ],
  [
    'outdated',
    'PRRT_thread_typo',
    [
      'reviewComment.openInDiff',
      'reviewComment.openOnGithub',
      'reviewComment.keepDraft',
      'reviewComment.edit',
      ...COMMENT_DECIDE,
      'reviewComment.copyLink',
    ],
  ],
  [
    'pushed',
    'PRRT_thread_timeout_config',
    ['reviewComment.openInDiff', 'reviewComment.openOnGithub', 'reviewComment.copyLink'],
  ],
  ['gone', 'PRRT_thread_nowhere', []],
];

describe('review and comment menus in every state', () => {
  beforeEach(() => {
    seedResolveScene({ expandedThreadId: null });
  });

  it('offers the Review layer actions for a pull request with a comment waiting', () => {
    expect(matrixOf({ kind: 'review', sessionId: REVIEW_SESSION })).toEqual(['review.push']);
  });

  it.each(REVIEW_COMMENT_STATES)('%s', (_state, threadId, expected) => {
    expect(matrixOf({ kind: 'reviewComment', sessionId: REVIEW_SESSION, threadId })).toEqual(
      expected,
    );
  });

  it('never marks a comment and pushes in the same step', async () => {
    const accepted: Array<string> = [];
    const published: Array<string> = [];
    useAppStore.setState({
      acceptResolveQueueItem: async ({ itemId }: { readonly itemId: string }) => {
        accepted.push(itemId);
      },
      publishConversations: async () => {
        published.push('push');
        return { kind: 'missing' };
      },
    } as never);
    await run(
      { kind: 'reviewComment', sessionId: REVIEW_SESSION, threadId: 'PRRT_thread_retry_backoff' },
      'reviewComment.accept',
    );
    expect(accepted).toEqual(['mock-resolve-item-retry-backoff']);
    expect(published).toEqual([]);
  });
});

describe('write review menu in every state', () => {
  const WRITE_REVIEW: ObjectTarget = { kind: 'writeReview', sessionId: SESSION, draftId: null };
  const draft = {
    id: 'draft-1',
    sessionId: SESSION,
    provider: 'github',
    repo: 'harborline/ledger-core',
    prNumber: 482,
    path: 'src/payouts/export.ts',
    line: 40,
    startLine: null,
    side: 'new',
    body: 'Stream the rows instead of buffering them.',
    status: 'draft',
    stale: false,
    origin: 'user',
    createdAt: FIXTURE_NOW,
  };

  it('blocks an empty comment review with its reason', () => {
    expect(matrixOf(WRITE_REVIEW)).toEqual([
      'writeReview.submit (Add a line comment or a summary first.)',
    ]);
  });

  it('submits and discards once a line comment is written', () => {
    useAppStore.setState({ reviewDrafts: { [SESSION]: [draft] } } as never);
    expect(matrixOf(WRITE_REVIEW)).toEqual(['writeReview.submit', 'writeReview.discard']);
    expect(matrixOf({ ...WRITE_REVIEW, draftId: 'draft-1' })).toEqual([
      'writeReview.submit',
      'writeReview.editDraft',
      'writeReview.deleteDraft',
      'writeReview.discard',
    ]);
  });

  it('says it is submitting while the review goes out', () => {
    useAppStore.setState({
      reviewDrafts: { [SESSION]: [draft] },
      reviewSubmission: {
        [SESSION]: { verdict: 'approve', summary: 'Looks right.', isSubmitting: true },
      },
    } as never);
    expect(matrixOf(WRITE_REVIEW)).toEqual([
      'writeReview.submit (Submitting now.)',
      'writeReview.discard',
    ]);
  });
});

describe('Open is never offered for the object already on screen', () => {
  it('drops Open on the artifact the viewer shows, and keeps it elsewhere', () => {
    seed({});
    useAppStore.setState({ sessionArtifacts: { [SESSION]: [storedArtifact({ kind: 'report' })] } });
    const bound = bindTarget({ state: useAppStore.getState(), target: storedTarget() });
    const viewed = (
      bound?.resolve({ viewing: { kind: 'artifact', id: 'artifact-payout' } }) ?? []
    ).map((action) => action.id);
    const elsewhere = (
      bound?.resolve({ viewing: { kind: 'artifact', id: 'artifact-other' } }) ?? []
    ).map((action) => action.id);
    expect(viewed).not.toContain('artifact.open');
    expect(elsewhere).toContain('artifact.open');
  });

  it('drops Open agent on the agent page, and keeps it elsewhere', () => {
    seed({ agents: [agentFixture()] });
    const bound = bindTarget({ state: useAppStore.getState(), target: AGENT_TARGET });
    expect(
      (bound?.resolve({ viewing: { kind: 'agent', id: AGENT } }) ?? []).map((action) => action.id),
    ).not.toContain('agent.open');
    expect((bound?.resolve() ?? []).map((action) => action.id)).toContain('agent.open');
  });

  it('drops Open run on the run page, and keeps it elsewhere', () => {
    seed(withRun({}));
    const bound = bindTarget({ state: useAppStore.getState(), target: RUN_TARGET });
    expect(
      (bound?.resolve({ viewing: { kind: 'workflowRun', id: RUN } }) ?? []).map(
        (action) => action.id,
      ),
    ).not.toContain('workflowRun.open');
    expect(
      (bound?.resolve({ viewing: { kind: 'agent', id: AGENT } }) ?? []).map((action) => action.id),
    ).toContain('workflowRun.open');
  });

  it('never runs Open on the object on screen', async () => {
    seed({ agents: [agentFixture()] });
    const before = useAppStore.getState().navigation;
    await runObjectAction({
      target: AGENT_TARGET,
      actionId: 'agent.open',
      env: { ...env, viewing: { kind: 'agent', id: AGENT } },
    });
    expect(useAppStore.getState().navigation).toBe(before);
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
    expect(useAppStore.getState().activeLens[SESSION]).toBe('branch');
    expect(useAppStore.getState().branchTab[SESSION]).toBe('comments');
    await run(SESSION_TARGET, 'session.diff');
    expect(useAppStore.getState().activeLens[SESSION]).toBe('branch');
    expect(useAppStore.getState().branchTab[SESSION]).toBe('files');
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
