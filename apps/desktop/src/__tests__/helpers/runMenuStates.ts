import {
  FIXTURE_NOW,
  RUN,
  STEP_BUILD,
  STEP_PLAN,
  mountFixture,
  questionFixture,
  runFixture,
  sessionFixture,
  stepAgent,
  workflowFixture,
  type ActionSeed,
} from './actionFixtures';
import { RUNNING } from './agentMenuStates';

export const withRun = (value: {
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

export const LIVE_RUN_TAIL = [
  'workflowRun.autonomy',
  'workflowRun.saveAsPreset',
  'workflowRun.copySummary',
  'workflowRun.close',
  'workflowRun.discard',
  'workflowRun.delete',
] as const;

export const RUN_STATES: ReadonlyArray<readonly [string, ActionSeed, ReadonlyArray<string>]> = [
  [
    'queued by hand',
    withRun({ run: { triggerMode: 'manual' } }),
    [
      'workflowRun.open',
      'workflowRun.diff',
      'workflowRun.start',
      'workflowRun.rename',
      'workflowRun.autonomy',
      'workflowRun.saveAsPreset',
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
      'workflowRun.pause',
      'workflowRun.rename',
      ...LIVE_RUN_TAIL,
    ],
  ],
  [
    'orchestrated and running',
    withRun({
      run: { executionMode: 'dynamic' },
      agents: [stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'running' })],
      turnStates: { 'agent-plan': RUNNING },
    }),
    [
      'workflowRun.open',
      'workflowRun.diff',
      'workflowRun.pause',
      'workflowRun.rename',
      'workflowRun.routing',
      ...LIVE_RUN_TAIL,
    ],
  ],
  [
    'orchestrated and paused by you',
    withRun({
      run: {
        executionMode: 'dynamic',
        orchestrationStop: { kind: 'paused', message: 'Paused by you.' },
      },
      agents: [stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'running' })],
      turnStates: { 'agent-plan': RUNNING },
    }),
    [
      'workflowRun.open',
      'workflowRun.diff',
      'workflowRun.resume',
      'workflowRun.rename',
      'workflowRun.routing',
      ...LIVE_RUN_TAIL,
    ],
  ],
  [
    'orchestrated and stopped by you',
    withRun({
      run: {
        executionMode: 'dynamic',
        orchestrationStop: { kind: 'operator', message: 'You stopped this run.' },
      },
      agents: [stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'running' })],
      turnStates: { 'agent-plan': RUNNING },
    }),
    [
      'workflowRun.open',
      'workflowRun.diff',
      'workflowRun.rename',
      'workflowRun.routing',
      ...LIVE_RUN_TAIL,
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
      'workflowRun.rename',
      ...LIVE_RUN_TAIL,
    ],
  ],
  [
    'paused on a stopped step',
    withRun({ agents: [stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'stopped' })] }),
    [
      'workflowRun.open',
      'workflowRun.diff',
      'workflowRun.continue',
      'workflowRun.rename',
      ...LIVE_RUN_TAIL,
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
      'workflowRun.rename',
      ...LIVE_RUN_TAIL,
    ],
  ],
  [
    'failed',
    withRun({ agents: [stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'failed' })] }),
    [
      'workflowRun.open',
      'workflowRun.diff',
      'workflowRun.restartStep',
      'workflowRun.rename',
      ...LIVE_RUN_TAIL,
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
      'workflowRun.rename',
      'workflowRun.saveAsPreset',
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
      'workflowRun.rename',
      'workflowRun.saveAsPreset',
      'workflowRun.restore',
      'workflowRun.copySummary',
      'workflowRun.delete',
    ],
  ],
];
