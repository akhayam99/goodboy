// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type OpenQuestion,
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
import { sessionRunCountsOf } from './sessionRunCountsOf';
import { sessionRunsOf } from './sessionRunsOf';

type WorldParams = {
  readonly runs?: ReadonlyArray<AttachedRun>;
  readonly agents?: ReadonlyArray<Agent>;
  readonly autoViews?: ReadonlyArray<AutoTreeView>;
  readonly questions?: ReadonlyArray<OpenQuestion>;
};

const runsOf = ({ runs = [], agents = [], autoViews = [], questions = [] }: WorldParams) =>
  sessionRunsOf({
    attachedRuns: runs,
    agents,
    kindOverride: {},
    autoViews,
    orchestrating: {},
    questions,
    rootTurns: {},
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
      origin: 'Was a preset run · Fix a layout',
      open: { kind: 'run', runId: preset.run.id },
    });
    expect(byKind.get('orchestrated')).toMatchObject({
      shape: 'plan',
      origin: 'Was an orchestrated run',
      open: { kind: 'run', runId: plan.run.id },
    });
    expect(byKind.get('auto')).toMatchObject({
      shape: 'lead',
      origin: 'Was an Auto conversation',
      stateWord: 'Done',
      open: { kind: 'auto', agentId: FIXTURE_ROOT },
    });
    expect(byKind.get('agent')).toMatchObject({
      shape: 'lead',
      origin: 'Was an agent · Scout',
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
