// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type OpenQuestion,
  type ProviderRunId,
  type TurnState,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { aDelegation, aView, FIXTURE_NOW, FIXTURE_ROOT } from '../auto/testing/autoViewFixtures';
import type { AttachedRun } from '../workflows/activeWorkflowRuns';
import { liveGroupsOf } from './central/now/liveGroupsOf';
import {
  aNowAgent,
  aNowRun,
  aNowStepAgent,
  aNowWorkflow,
  NOW_SESSION,
  NOW_STARTED_AT,
  nowModelOf,
} from './central/now/testing/nowModelOf';
import { pageSlotOf } from './pageSlot';
import { buildTimelineStream } from './timeline/buildTimelineStream';
import { runSpawnedRowsOf } from '../../app/components/SpawnedPanel/runSpawnedRowsOf';
import { sessionRunCountsOf } from './sessionRunCountsOf';
import { sessionRunsOf } from './sessionRunsOf';

type WorldParams = {
  readonly runs?: ReadonlyArray<AttachedRun>;
  readonly agents?: ReadonlyArray<Agent>;
  readonly autoViews?: ReadonlyArray<AutoTreeView>;
  readonly questions?: ReadonlyArray<OpenQuestion>;
  readonly turns?: ReadonlyMap<string, TurnState>;
};

const BLOCKED: TurnState = {
  kind: 'blocked',
  runId: brandId<ProviderRunId>({ value: 'run-harborline' }),
  blockedAt: NOW_STARTED_AT,
};

const runsOf = ({
  runs = [],
  agents = [],
  autoViews = [],
  questions = [],
  turns = new Map(),
}: WorldParams) =>
  sessionRunsOf({
    attachedRuns: runs,
    agents,
    kindOverride: {},
    autoViews,
    orchestrating: {},
    questions,
    rootTurns: {},
    turnByAgentId: turns,
  });

const presetRun = () =>
  aNowRun({
    key: 'preset',
    title: 'Center the profile page',
    workflow: aNowWorkflow({
      key: 'preset',
      name: 'Fix a layout',
      stepNames: ['Find', 'Center', 'Check'],
    }),
  });

const orchestratedRun = () =>
  aNowRun({
    key: 'plan',
    title: 'Center every member page',
    isDynamic: true,
    workflow: aNowWorkflow({
      key: 'plan',
      name: 'Orchestrated',
      stepNames: ['Find', 'Center'],
      origin: 'orchestrated',
    }),
  });

type StatusParams = {
  readonly status: Agent['status'];
};

const autoRoot = ({ status }: StatusParams): Agent =>
  anAgent({
    id: FIXTURE_ROOT,
    sessionId: NOW_SESSION,
    kind: 'auto',
    name: 'Fix the team page header on mobile',
    status,
    startedAt: NOW_STARTED_AT,
  });

const autoChild = (): Agent =>
  anAgent({
    id: brandId<AgentId>({ value: 'agent-fixer' }),
    sessionId: NOW_SESSION,
    parentAgentId: FIXTURE_ROOT,
    name: 'Fixer',
    status: 'running',
  });

const handScout = ({ status }: StatusParams): Agent =>
  aNowAgent({
    key: 'scout',
    name: 'Which member pages still use the old wrapper?',
    status,
    kind: 'scout',
  });

describe('sessionRunsOf', () => {
  it('gives one row per request, never one per step or child', () => {
    const preset = presetRun();
    const plan = orchestratedRun();
    const agents = [
      aNowStepAgent({ attached: preset, stepIndex: 0, status: 'completed', name: 'Find' }),
      aNowStepAgent({ attached: preset, stepIndex: 1, status: 'running', name: 'Center' }),
      aNowStepAgent({ attached: plan, stepIndex: 0, status: 'running', name: 'Find' }),
      autoRoot({ status: 'running' }),
      autoChild(),
      handScout({ status: 'completed' }),
    ];
    const runs = runsOf({
      runs: [preset, plan],
      agents,
      autoViews: [aView({ phase: 'waiting' })],
    });

    expect(runs.map((run) => run.kind).sort()).toEqual(['agent', 'auto', 'orchestrated', 'preset']);
    expect(runs.find((run) => run.kind === 'preset')?.agentIds).toHaveLength(2);
    expect(runs.find((run) => run.kind === 'auto')?.agentIds).toEqual([
      FIXTURE_ROOT,
      'agent-fixer',
    ]);
  });

  it('reads old rows of the four kinds in place, with what they were', () => {
    const preset = presetRun();
    const plan = orchestratedRun();
    const runs = runsOf({
      runs: [preset, plan],
      agents: [autoRoot({ status: 'completed' }), handScout({ status: 'completed' })],
      autoViews: [aView({ phase: 'finished', rootAsk: 'Fix the team page header on mobile' })],
    });
    const byKind = new Map(runs.map((run) => [run.kind, run]));

    expect(byKind.get('preset')).toMatchObject({
      shape: 'plan',
      title: 'Center the profile page',
      origin: 'Workflow · Preset Fix a layout',
      open: { kind: 'run', runId: preset.run.id },
    });
    expect(byKind.get('orchestrated')).toMatchObject({
      shape: 'plan',
      origin: 'Workflow · Orchestrated',
      open: { kind: 'run', runId: plan.run.id },
    });
    expect(byKind.get('auto')).toMatchObject({
      shape: 'lead',
      origin: 'Agent · Auto agent',
      stateWord: 'Done',
      open: { kind: 'auto', agentId: FIXTURE_ROOT },
    });
    expect(byKind.get('agent')).toMatchObject({
      shape: 'lead',
      origin: 'Agent · Scout',
      stateWord: 'Done',
      progress: '1 agent',
      open: { kind: 'agent', agentId: 'agent-scout' },
    });
  });

  it('lists the newest request first', () => {
    const preset = presetRun();
    const later = aNowRun({
      key: 'later',
      title: 'Later',
      workflow: aNowWorkflow({ key: 'later', name: 'Fix a layout', stepNames: ['Find'] }),
      overrides: { createdAt: brandId<IsoDateTime>({ value: '2026-10-13T12:00:00.000Z' }) },
    });
    const runs = runsOf({ runs: [preset, later] });

    expect(runs.map((run) => run.title)).toEqual(['Later', 'Center the profile page']);
  });

  it('marks a hand agent with an open question as needing you', () => {
    const scout = handScout({ status: 'completed' });
    const question = {
      id: brandId({ value: 'question-1' }),
      sessionId: NOW_SESSION,
      createdByAgentId: scout.id,
      text: 'Which width matters most?',
      suggestedAnswers: [],
      isBlocking: true,
      userAnswer: null,
      status: 'open',
      createdAt: NOW_STARTED_AT,
    } satisfies OpenQuestion;
    const [row] = runsOf({ agents: [scout], questions: [question] });

    expect(row).toMatchObject({ dot: 'needsYou', stateWord: 'Needs you', isWaiting: true });
  });
});

describe('the rail count, the Runs list and the Now card', () => {
  const preset = presetRun();
  const plan = orchestratedRun();
  type World = Required<Pick<WorldParams, 'runs' | 'agents'>> & WorldParams;
  const worlds: ReadonlyArray<readonly [string, World]> = [
    [
      'a running hand agent blocked on a permission and a running preset step',
      {
        runs: [preset],
        agents: [
          aNowStepAgent({ attached: preset, stepIndex: 0, status: 'running', name: 'Find' }),
          handScout({ status: 'running' }),
        ],
        turns: new Map([['agent-scout', BLOCKED]]),
      },
    ],
    [
      'a running preset run and a running hand agent',
      {
        runs: [preset],
        agents: [
          aNowStepAgent({ attached: preset, stepIndex: 0, status: 'running', name: 'Find' }),
          handScout({ status: 'running' }),
        ],
      },
    ],
    [
      'a running orchestrated run, a working Auto and a finished agent',
      {
        runs: [plan],
        agents: [
          aNowStepAgent({ attached: plan, stepIndex: 0, status: 'running', name: 'Find' }),
          autoRoot({ status: 'running' }),
          autoChild(),
          handScout({ status: 'completed' }),
        ],
        autoViews: [
          aView({
            phase: 'waiting',
            delegations: [aDelegation({ key: 'fixer', role: 'implementer', state: 'running' })],
          }),
        ],
      },
    ],
    [
      'a failed hand agent and a finished preset run',
      {
        runs: [preset],
        agents: [
          aNowStepAgent({ attached: preset, stepIndex: 0, status: 'completed', name: 'Find' }),
          aNowStepAgent({ attached: preset, stepIndex: 1, status: 'completed', name: 'Center' }),
          aNowStepAgent({ attached: preset, stepIndex: 2, status: 'completed', name: 'Check' }),
          handScout({ status: 'failed' }),
        ],
      },
    ],
  ];

  it.each(worlds)('agree on %s', (_name, world) => {
    const runs = runsOf(world);
    const counts = sessionRunCountsOf({ runs });
    const groups = liveGroupsOf({
      model: nowModelOf({
        agents: world.agents,
        runs: world.runs,
        autoTrees: world.autoViews ?? [],
        turnByAgentId: world.turns ?? new Map(),
      }),
      agents: world.agents,
      now: FIXTURE_NOW,
    });
    const listed = runs.filter((run) => !run.isArchived && run.isInProgress);
    const slot = pageSlotOf({
      page: 'runs',
      facts: {
        changedFiles: 0,
        runs: counts.runs,
        runningRuns: counts.runningRuns,
        waitingRuns: counts.waitingRuns,
        artifacts: 0,
        openQuestions: 0,
      },
    });

    expect(counts.inProgress).toBe(listed.length);
    expect(groups).toHaveLength(counts.inProgress);
    expect(Number(slot.text ?? '0')).toBe(
      counts.waitingRuns > 0
        ? counts.waitingRuns
        : counts.runningRuns > 0
          ? counts.runningRuns
          : counts.runs,
    );
  });
});

describe('a permission-blocked agent', () => {
  const scout = () => handScout({ status: 'running' });
  const turns = new Map([['agent-scout', BLOCKED]]);

  it('reads the same word on the Runs grid, the page count, the Running card and the Agents tree', () => {
    const runs = runsOf({ agents: [scout()], turns });
    const counts = sessionRunCountsOf({ runs });
    const model = nowModelOf({ agents: [scout()], turnByAgentId: turns });
    const [group] = liveGroupsOf({ model, agents: [scout()], now: FIXTURE_NOW });
    const tree = runSpawnedRowsOf({
      items: buildTimelineStream({
        entries: model.entries,
        unreadAgentIds: new Set(),
        advanceByRunId: new Map(),
        decidingRunIds: new Set(),
        dayLabelFor: () => null,
        turnByAgentId: turns,
      }).items,
      baseLevel: 0,
    });
    const row = tree.find((entry) => entry.kind === 'agent');

    expect(runs[0]).toMatchObject({
      dot: 'needsYou',
      stateWord: 'Needs permission',
      isWaiting: true,
    });
    expect(counts).toMatchObject({ runningRuns: 0, waitingRuns: 1 });
    expect(
      pageSlotOf({
        page: 'runs',
        facts: {
          changedFiles: 0,
          runs: counts.runs,
          runningRuns: counts.runningRuns,
          waitingRuns: counts.waitingRuns,
          artifacts: 0,
          openQuestions: 0,
        },
      }).tone,
    ).toBe('warning');
    expect(group?.state).toBe('waiting');
    expect(row).toMatchObject({
      kind: 'agent',
      row: { node: 'approval', word: 'Needs permission', isLive: false },
    });
  });

  it('is running again once the turn is no longer blocked', () => {
    const [row] = runsOf({ agents: [scout()] });

    expect(row).toMatchObject({ dot: 'running', stateWord: 'Running', isWaiting: false });
  });
});

describe('the Runs grid order and the states it files', () => {
  it('puts what needs you first, then running, then the rest, newest first inside each', () => {
    const early = aNowAgent({ key: 'early', name: 'Early runner', status: 'running' });
    const late = {
      ...aNowAgent({ key: 'late', name: 'Late runner', status: 'running' }),
      startedAt: brandId<IsoDateTime>({ value: '2026-10-13T11:58:00.000Z' }),
    };
    const asker = aNowAgent({ key: 'asker', name: 'Asker', status: 'running' });
    const failed = aNowAgent({ key: 'failed', name: 'Failed agent', status: 'failed' });
    const idle = aNowAgent({ key: 'idle', name: 'Idle agent', status: 'pending' });
    const turns = new Map([['agent-asker', BLOCKED]]);

    const titles = runsOf({ agents: [early, late, asker, failed, idle], turns }).map(
      (run) => run.title,
    );

    expect(titles).toEqual(['Asker', 'Failed agent', 'Late runner', 'Early runner', 'Idle agent']);
  });

  it('lifts a finished agent with an unread reply above the ones already read', () => {
    const read = {
      ...aNowAgent({ key: 'read', name: 'Read reviewer', status: 'completed' }),
      lastFinishedAt: brandId<IsoDateTime>({ value: '2026-10-13T12:00:00.000Z' }),
      lastViewedAt: brandId<IsoDateTime>({ value: '2026-10-13T12:05:00.000Z' }),
    };
    const unread = {
      ...aNowAgent({ key: 'unread', name: 'Unread reviewer', status: 'completed' }),
      startedAt: brandId<IsoDateTime>({ value: '2026-10-13T11:40:00.000Z' }),
      lastFinishedAt: brandId<IsoDateTime>({ value: '2026-10-13T12:10:00.000Z' }),
    };

    const runs = runsOf({ agents: [read, unread] });

    expect(runs.map((run) => [run.title, run.isUnread])).toEqual([
      ['Unread reviewer', true],
      ['Read reviewer', false],
    ]);
  });

  it('keeps an agent a restart stopped in progress with a Continue word', () => {
    const stopped = aNowAgent({
      key: 'stopped',
      name: 'Stopped by restart',
      status: 'stopped',
      stoppedBy: 'app',
    });

    const [row] = runsOf({ agents: [stopped] });

    expect(row).toMatchObject({
      dot: 'stopped',
      stateWord: 'Stopped, Continue',
      isFinished: false,
      isInProgress: false,
      isRestartStopped: true,
    });
  });

  it('files a stopped agent the person closed under Finished', () => {
    const closed = {
      ...aNowAgent({ key: 'closed', name: 'Closed agent', status: 'stopped' }),
      doneAt: NOW_STARTED_AT,
    };

    const [row] = runsOf({ agents: [closed] });

    expect(row).toMatchObject({ dot: 'stopped', stateWord: 'Stopped', isFinished: true });
  });

  it('reads a blocked agent as a warning, not a failure', () => {
    const [row] = runsOf({
      agents: [aNowAgent({ key: 'blocked', name: 'Blocked agent', status: 'blocked' })],
    });

    expect(row).toMatchObject({ dot: 'needsYou', stateWord: 'Blocked', isWaiting: true });
  });
});
