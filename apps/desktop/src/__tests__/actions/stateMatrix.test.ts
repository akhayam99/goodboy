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

const generationTarget = (state: 'generating' | 'waiting' | 'unproduced', canStop: boolean) =>
  ({
    kind: 'artifact',
    sessionId: SESSION,
    subject: {
      kind: 'generation',
      generation: {
        agentId: AGENT,
        kind: 'report',
        title: 'Session summary',
        state,
        startedAt: FIXTURE_NOW,
        provider: null,
        model: null,
        isTurnRunning: state === 'generating',
        scouts: [],
        canStop,
      },
    },
  }) as ObjectTarget;

const EXPORTS = [
  'artifact.copySource',
  'artifact.saveSource',
  'artifact.openInBrowser (This session has no workspace folder)',
  'artifact.showInFinder (This session has no workspace folder)',
];

const ARTIFACT_STATES: ReadonlyArray<
  readonly [string, ReturnType<typeof storedArtifact> | null, ObjectTarget, ReadonlyArray<string>]
> = [
  [
    'plan ready to run',
    storedArtifact({ kind: 'plan' }),
    storedTarget(),
    [
      'artifact.open',
      'artifact.openAgent',
      'artifact.runPlan',
      'artifact.edit',
      ...EXPORTS,
      'artifact.discard',
    ],
  ],
  [
    'plan running',
    storedArtifact({ kind: 'plan' }),
    storedTarget({ isPlanRunning: true }),
    ['artifact.open', 'artifact.openAgent', ...EXPORTS],
  ],
  [
    'plan that already ran',
    storedArtifact({ kind: 'plan', status: 'consumed' }),
    storedTarget(),
    ['artifact.open', 'artifact.openAgent', 'artifact.runAgain', ...EXPORTS],
  ],
  [
    'plan replaced by a newer one',
    storedArtifact({ kind: 'plan', status: 'superseded' }),
    storedTarget(),
    ['artifact.open', 'artifact.openAgent', 'artifact.runAgain', ...EXPORTS, 'artifact.discard'],
  ],
  [
    'plan discarded',
    storedArtifact({ kind: 'plan', status: 'discarded' }),
    storedTarget(),
    ['artifact.open', 'artifact.openAgent', 'artifact.restore', ...EXPORTS],
  ],
  [
    'report ready, its evidence gone',
    storedArtifact({ kind: 'report' }),
    storedTarget(),
    [
      'artifact.open',
      'artifact.edit',
      'artifact.regenerate (The evidence pack this report was built from is no longer in memory, so regenerating would build a different report)',
      ...EXPORTS,
    ],
  ],
  [
    'wireframe ready',
    storedArtifact({ kind: 'wireframe' }),
    storedTarget(),
    ['artifact.open', 'artifact.newVariant', ...EXPORTS],
  ],
  [
    'generating',
    null,
    generationTarget('generating', true),
    ['artifact.openAgent', 'artifact.stop'],
  ],
  ['waiting on you', null, generationTarget('waiting', false), ['artifact.openAgent']],
  [
    'failed to produce',
    null,
    generationTarget('unproduced', false),
    ['artifact.openAgent', 'artifact.retry'],
  ],
];

describe('artifact menu in every state', () => {
  it.each(ARTIFACT_STATES)('%s', (_state, artifact, target, expected) => {
    seed({});
    useAppStore.setState({ sessionArtifacts: { [SESSION]: artifact === null ? [] : [artifact] } });
    expect(matrixOf(target)).toEqual(expected);
  });

  it('shows nothing for an artifact that is gone', () => {
    seed({});
    expect(matrixOf(storedTarget())).toEqual([]);
  });

  it('asks before a plan runs again and before a discard', () => {
    seed({});
    useAppStore.setState({
      sessionArtifacts: { [SESSION]: [storedArtifact({ kind: 'plan', status: 'superseded' })] },
    });
    const actions = bindTarget({
      state: useAppStore.getState(),
      target: storedTarget(),
    })?.resolve();
    expect(actions?.find((action) => action.id === 'artifact.runAgain')?.confirm?.role).toBe(
      'alert',
    );
    expect(actions?.find((action) => action.id === 'artifact.discard')?.confirm?.role).toBe(
      'danger',
    );
  });

  it('discards and restores a plan on the real store', async () => {
    seed({});
    const deletePlan = vi.fn(async () => undefined);
    const restorePlan = vi.fn(async () => undefined);
    useAppStore.setState({
      sessionArtifacts: { [SESSION]: [storedArtifact({ kind: 'plan' })] },
      deletePlan,
      restorePlan,
    });
    await run(storedTarget(), 'artifact.discard');
    expect(deletePlan).toHaveBeenCalledWith(SESSION, 'artifact-payout');
    useAppStore.setState({
      sessionArtifacts: { [SESSION]: [storedArtifact({ kind: 'plan', status: 'discarded' })] },
    });
    await run(storedTarget(), 'artifact.restore');
    expect(restorePlan).toHaveBeenCalledWith(SESSION, 'artifact-payout');
  });

  it('copies the source of a stored artifact', async () => {
    seed({});
    useAppStore.setState({ sessionArtifacts: { [SESSION]: [storedArtifact({ kind: 'report' })] } });
    copies.length = 0;
    await run(storedTarget(), 'artifact.copySource');
    expect(copies).toEqual(['# Speed up the payout export']);
  });
});

const pullRequest = (
  fields: Partial<{
    state: 'open' | 'merged' | 'closed' | 'queued';
    isDraft: boolean;
    readiness: 'ready' | 'blocked' | 'unknown';
    writeInFlight: string | null;
    canCreateNew: boolean;
  }>,
): ObjectTarget => ({
  kind: 'pullRequest',
  facts: {
    number: 482,
    state: fields.state ?? 'open',
    isDraft: fields.isDraft ?? false,
    url: 'https://github.com/harborline/ledger-core/pull/482',
    headBranch: 'hl/payout-export',
    baseBranch: 'main',
    mergeReadiness: {
      status: fields.readiness ?? 'ready',
      reason:
        fields.readiness === 'blocked'
          ? 'Resolve the conflicts with main first'
          : 'Squash merge this pull request',
      caveats: [],
    },
    writeInFlight: fields.writeInFlight ?? null,
    isBusy: (fields.writeInFlight ?? null) !== null,
    canCreateNew: fields.canCreateNew ?? true,
    onMerge: async () => undefined,
    onMarkReady: () => undefined,
    onConvertDraft: () => undefined,
    onClose: () => undefined,
    onReopen: () => undefined,
    onCreateNew: () => undefined,
  },
});

const PR_STATES: ReadonlyArray<readonly [string, ObjectTarget, ReadonlyArray<string>]> = [
  [
    'draft',
    pullRequest({ isDraft: true, readiness: 'blocked' }),
    [
      'pullRequest.openOnGithub',
      'pullRequest.merge (Resolve the conflicts with main first)',
      'pullRequest.markReady',
      'pullRequest.createNew',
      'pullRequest.copyLink',
      'pullRequest.copyBranch',
      'pullRequest.close',
    ],
  ],
  [
    'open',
    pullRequest({}),
    [
      'pullRequest.openOnGithub',
      'pullRequest.merge',
      'pullRequest.convertDraft',
      'pullRequest.createNew',
      'pullRequest.copyLink',
      'pullRequest.copyBranch',
      'pullRequest.close',
    ],
  ],
  [
    'open, another window writing it',
    pullRequest({ writeInFlight: 'Goodboy is already merging #482' }),
    [
      'pullRequest.openOnGithub',
      'pullRequest.merge (Goodboy is already merging #482)',
      'pullRequest.convertDraft (Goodboy is already merging #482)',
      'pullRequest.createNew (Goodboy is already merging #482)',
      'pullRequest.copyLink',
      'pullRequest.copyBranch',
      'pullRequest.close (Goodboy is already merging #482)',
    ],
  ],
  [
    'merged',
    pullRequest({ state: 'merged', readiness: 'blocked' }),
    [
      'pullRequest.openOnGithub',
      'pullRequest.merge (Resolve the conflicts with main first)',
      'pullRequest.createNew',
      'pullRequest.copyLink',
      'pullRequest.copyBranch',
    ],
  ],
  [
    'closed',
    pullRequest({ state: 'closed', readiness: 'blocked' }),
    [
      'pullRequest.openOnGithub',
      'pullRequest.merge (Resolve the conflicts with main first)',
      'pullRequest.reopen',
      'pullRequest.createNew',
      'pullRequest.copyLink',
      'pullRequest.copyBranch',
    ],
  ],
  [
    'open while an agent drafts a new one',
    pullRequest({ canCreateNew: false }),
    [
      'pullRequest.openOnGithub',
      'pullRequest.merge',
      'pullRequest.convertDraft',
      'pullRequest.createNew (An agent is already opening a pull request for this session)',
      'pullRequest.copyLink',
      'pullRequest.copyBranch',
      'pullRequest.close',
    ],
  ],
];

describe('pull request menu in every state', () => {
  it.each(PR_STATES)('%s', (_state, target, expected) => {
    expect(matrixOf(target)).toEqual(expected);
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

const commitTarget = (older: number): ObjectTarget => ({
  kind: 'commit',
  facts: {
    sha: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1',
    shortSha: 'b2c3d4e',
    subject: 'Keep trailing-comma rows in the ledger-core importer',
    older: Array.from({ length: older }, (_, index) => ({
      sha: `a${index}`,
      shortSha: `a${index}`,
      subject: 'Add a failing importer fixture',
      author: 'Robin Vale',
      timestamp: 1_787_890_000,
      pushed: false,
      parentSha: null,
    })),
    onPick: noop,
    onReword: noop,
    onSquash: noop,
    onFold: noop,
    onDrop: noop,
    onMove: noop,
  },
});

const mountTarget = (fields: {
  readonly hasTools: boolean;
  readonly isAttached: boolean;
  readonly editors: number;
  readonly canStartTurnsHere?: boolean;
}): ObjectTarget => ({
  kind: 'mount',
  facts: {
    mountKey: 'mount:ledger-core',
    noun: 'worktree',
    worktreePath: fields.hasTools ? '/work/ledger-core' : null,
    branch: 'hl/payout-export',
    hasTools: fields.hasTools,
    canStartTurnsHere: fields.canStartTurnsHere ?? false,
    hasMount: true,
    isAttached: fields.isAttached,
    canDetach: false,
    editors: Array.from({ length: fields.editors }, () => ({ binary: 'code', label: 'VS Code' })),
    onTerminal: noop,
    onScripts: noop,
    onStartTurnsHere: noop,
    onOpenEditor: noop,
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
    'commit with older commits',
    commitTarget(1),
    [
      'commit.pick',
      'commit.reword',
      'commit.squash',
      'commit.fold',
      'commit.moveUp',
      'commit.moveDown',
      'commit.copySha',
      'commit.copySubject',
      'commit.drop',
    ],
  ],
  [
    'oldest commit',
    commitTarget(0),
    [
      'commit.pick',
      'commit.reword',
      'commit.squash (No older commit below this one)',
      'commit.fold (No older commit below this one)',
      'commit.moveUp',
      'commit.moveDown',
      'commit.copySha',
      'commit.copySubject',
      'commit.drop',
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
    'mount open, another mount takes new turns',
    mountTarget({ hasTools: true, isAttached: true, editors: 1, canStartTurnsHere: true }),
    [
      'mount.terminal',
      'mount.scripts',
      'mount.editor',
      'mount.startTurns',
      'mount.copyPath',
      'mount.copyBranch',
      'mount.close',
    ],
  ],
  [
    'mount open, no editor installed',
    mountTarget({ hasTools: true, isAttached: true, editors: 0 }),
    [
      'mount.terminal',
      'mount.scripts',
      'mount.editor (No editor detected)',
      'mount.copyPath',
      'mount.copyBranch',
      'mount.close',
    ],
  ],
  [
    'mount closed',
    mountTarget({ hasTools: false, isAttached: false, editors: 1 }),
    ['mount.copyBranch', 'mount.remove'],
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

  it('folds into the chosen older commit from the submenu', async () => {
    const onFold = vi.fn();
    const target = commitTarget(2);
    if (target.kind !== 'commit') {
      throw new Error('expected a commit');
    }
    await run({ ...target, facts: { ...target.facts, onFold } }, 'commit.fold', 'a1');
    expect(onFold).toHaveBeenCalledWith('a1');
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
