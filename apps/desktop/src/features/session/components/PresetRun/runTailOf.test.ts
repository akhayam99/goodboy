// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, StepId, Workflow, WorkflowId } from '@goodboy/types';
import { aWorkflowRun, anAgent } from '@goodboy/types/testing';
import type { NextAction } from '../../../workflows/resolveNextAction';
import { NAMES } from '../../../../shared/utils/names';
import { runTailOf, type RunTail } from './runTailOf';

const WORKFLOW_ID: WorkflowId = JSON.parse('"workflow-ledger"');
const STEP_ONE: StepId = JSON.parse('"step-scout"');
const STEP_TWO: StepId = JSON.parse('"step-implement"');
const SCOUT: AgentId = JSON.parse('"agent-scout"');
const IMPLEMENTER: AgentId = JSON.parse('"agent-implementer"');

const WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: JSON.parse('"workspace-harborline"'),
  name: 'Fix flaky tests',
  description: '',
  steps: [
    { id: STEP_ONE, workflowId: WORKFLOW_ID, ordinal: 0, name: 'Find', promptPrefix: '' },
    { id: STEP_TWO, workflowId: WORKFLOW_ID, ordinal: 1, name: 'Fix', promptPrefix: '' },
  ],
  createdAt: JSON.parse('"2026-10-16T09:00:00.000Z"'),
  updatedAt: JSON.parse('"2026-10-16T09:00:00.000Z"'),
};

const NONE: NextAction = { kind: 'none' };

type AgentsParams = {
  readonly scout: Agent['status'];
  readonly implementer: Agent['status'];
};

const agentsOf = ({ scout, implementer }: AgentsParams): ReadonlyArray<Agent> => [
  anAgent({ id: SCOUT, stepId: STEP_ONE, status: scout, ordinal: 0 }),
  anAgent({ id: IMPLEMENTER, stepId: STEP_TWO, status: implementer, ordinal: 1 }),
];

const TAIL_WORDS: ReadonlySet<string> = new Set([
  NAMES.running,
  NAMES.needsYou,
  NAMES.needsApproval,
  NAMES.stopped,
  NAMES.paused,
  NAMES.failed,
  NAMES.notFinished,
  NAMES.ready,
  NAMES.queued,
]);

type BaseParams = Partial<Parameters<typeof runTailOf>[0]>;

const tailOf = ({ ...overrides }: BaseParams) =>
  runTailOf({
    run: aWorkflowRun({ workflowId: WORKFLOW_ID }),
    workflow: WORKFLOW,
    agents: agentsOf({ scout: 'completed', implementer: 'running' }),
    isCompleted: false,
    primary: null,
    nextAction: NONE,
    quiet: null,
    selectedRootId: null,
    restartStoppedCount: 0,
    question: null,
    ...overrides,
  });

describe('runTailOf', () => {
  it('says a paused run is paused and leaves Continue to the header', () => {
    expect(
      tailOf({
        agents: agentsOf({ scout: 'completed', implementer: 'pending' }),
        primary: { kind: 'resume', label: 'Continue' },
      }),
    ).toEqual({ state: 'stopped', phrase: 'Paused', stepAgentId: null, verb: null });
  });

  it('stays silent while the step on screen runs, since its own line speaks', () => {
    expect(tailOf({ selectedRootId: IMPLEMENTER })).toBeNull();
  });

  it('points at the running step from any other entry', () => {
    expect(tailOf({ selectedRootId: SCOUT })).toMatchObject({
      state: 'working',
      phrase: 'Running',
      verb: { kind: 'openStep', agentId: IMPLEMENTER, label: 'Open step 2' },
    });
  });

  it('offers Continue after a quiet stretch', () => {
    expect(tailOf({ quiet: { agentId: IMPLEMENTER, minutes: 15 } })).toMatchObject({
      phrase: 'Needs you',
      verb: { kind: 'quiet', agentId: IMPLEMENTER },
    });
  });

  it('offers Continue all for agents a restart stopped', () => {
    expect(
      tailOf({
        agents: agentsOf({ scout: 'completed', implementer: 'stopped' }),
        restartStoppedCount: 2,
      }),
    ).toMatchObject({
      phrase: 'Stopped',
      verb: { kind: 'resumeAll', count: 2 },
    });
  });

  it('puts Start step on the tail once a step is done and the next waits', () => {
    expect(
      tailOf({
        agents: agentsOf({ scout: 'completed', implementer: 'pending' }),
        primary: { kind: 'start-step', label: 'Start step 2' },
      }),
    ).toMatchObject({
      phrase: 'Ready',
      verb: { kind: 'primary', primary: { kind: 'start-step' } },
    });
  });

  it('says a manual run is ready on your press, or names the run it follows', () => {
    const primary = { kind: 'start-run', label: 'Start run' } as const;
    const agents = agentsOf({ scout: 'pending', implementer: 'pending' });
    expect(tailOf({ agents, primary })?.phrase).toBe('Ready');
    expect(
      tailOf({
        agents,
        primary,
        run: aWorkflowRun({ triggerMode: 'after_run' }),
      })?.phrase,
    ).toBe('Queued');
  });

  it('asks to raise the cap when the run stopped at it', () => {
    expect(
      tailOf({
        agents: agentsOf({ scout: 'completed', implementer: 'pending' }),
        run: aWorkflowRun({ orchestrationStop: { kind: 'budget', message: 'Paused' } }),
      }),
    ).toMatchObject({ state: 'paused', verb: { kind: 'raiseCap' } });
  });

  it('keeps the limit in the phrase and the answer as the verb when questions wait on a run stopped at it', () => {
    const open = JSON.parse(
      '{"id":"q-window","sessionId":"s","text":"Batch refunds?","isBlocking":true,"userAnswer":null,"status":"open","createdAt":"2026-10-16T09:00:00.000Z"}',
    );
    expect(
      tailOf({
        agents: agentsOf({ scout: 'completed', implementer: 'pending' }),
        run: aWorkflowRun({ orchestrationStop: { kind: 'budget', message: 'Paused' } }),
        question: open,
      }),
    ).toMatchObject({ state: 'paused', phrase: 'Needs you', verb: { kind: 'answer' } });
  });

  it.each([
    ['failure', 'failed', 'Failed'],
    ['operator', 'stopped', 'Stopped'],
    ['paused', 'stopped', 'Paused'],
    ['needs-approval', 'waiting', 'Needs approval'],
    ['plan-approval', 'waiting', 'Needs approval'],
    ['preset-change', 'waiting', 'Needs you'],
  ] as const)(
    'names the %s stop instead of waiting for an answer when questions wait on it',
    (kind, state, phrase) => {
      const open = JSON.parse(
        '{"id":"q-window","sessionId":"s","text":"Batch refunds?","isBlocking":true,"userAnswer":null,"status":"open","createdAt":"2026-10-16T09:00:00.000Z"}',
      );
      expect(
        tailOf({
          agents: agentsOf({ scout: 'completed', implementer: 'pending' }),
          run: aWorkflowRun({ orchestrationStop: { kind, message: 'Stopped for Northwind' } }),
          question: open,
        }),
      ).toMatchObject({ state, phrase, verb: { kind: 'answer' } });
    },
  );

  it('keeps waiting for the answer on a stop that is only the questions', () => {
    const open = JSON.parse(
      '{"id":"q-window","sessionId":"s","text":"Batch refunds?","isBlocking":true,"userAnswer":null,"status":"open","createdAt":"2026-10-16T09:00:00.000Z"}',
    );
    expect(
      tailOf({
        agents: agentsOf({ scout: 'completed', implementer: 'pending' }),
        run: aWorkflowRun({ orchestrationStop: { kind: 'questions', message: 'Asked' } }),
        question: open,
      })?.phrase,
    ).toBe('Needs you');
  });

  it('offers Continue on a step you stopped', () => {
    expect(
      tailOf({ agents: agentsOf({ scout: 'completed', implementer: 'stopped' }) }),
    ).toMatchObject({
      phrase: 'Stopped',
      verb: { kind: 'continueStep', agentId: IMPLEMENTER },
    });
  });

  it('draws no tail on a finished run and no verb on a stopped one', () => {
    expect(tailOf({ isCompleted: true })).toBeNull();
    expect(
      tailOf({ run: aWorkflowRun({ orchestrationStop: { kind: 'closed', message: 'Closed' } }) }),
    ).toMatchObject({ phrase: 'Stopped', verb: null });
  });

  it('draws no tail on an archived run, whose Restore is in the header', () => {
    expect(
      tailOf({ run: aWorkflowRun({ discardedAt: JSON.parse('"2026-10-16T10:00:00.000Z"') }) }),
    ).toBeNull();
  });

  it.each([
    ['continue', 'Continue', 'stopped', 'Stopped'],
    ['retry', 'Retry', 'failed', 'Failed'],
    ['hint', 'Add a hint and continue', 'needsYou', 'Needs you'],
    ['decide-next', 'Decide next step', 'idle', 'Ready'],
  ] as const)(
    'reads %s as a state word with one link to the run on a step page',
    (kind, label, state, phrase) => {
      expect(
        tailOf({
          agents: agentsOf({ scout: 'completed', implementer: 'pending' }),
          primary: { kind, label },
          selectedRootId: SCOUT,
        }),
      ).toEqual({ state, phrase, stepAgentId: null, verb: { kind: 'openRun' } });
    },
  );

  it('leaves the verb of a run kind to the header on the run page itself', () => {
    expect(
      tailOf({
        agents: agentsOf({ scout: 'completed', implementer: 'pending' }),
        primary: { kind: 'retry', label: 'Retry' },
      }),
    ).toMatchObject({
      phrase: 'Failed',
      verb: { kind: 'primary', primary: { kind: 'retry' } },
    });
  });

  const recoverOf = ({ isBlocked }: { readonly isBlocked: boolean }) => {
    const step = WORKFLOW.steps[1];
    if (step === undefined) {
      throw new Error('no step');
    }
    return {
      kind: 'recover',
      subjectAgentId: IMPLEMENTER,
      step,
      isBlocked,
      sentence: 'Fix stopped before finishing.',
      cause: 'The run finishes once this step is done.',
    } as const;
  };

  it.each([
    ['blocked', true],
    ['failed', false],
  ] as const)(
    'reads a %s step on the run page as Needs you with Open step',
    (status, isBlocked) => {
      expect(
        tailOf({
          agents: agentsOf({ scout: 'completed', implementer: status }),
          nextAction: recoverOf({ isBlocked }),
        }),
      ).toEqual({
        state: 'needsYou',
        phrase: 'Needs you',
        stepAgentId: null,
        verb: { kind: 'openStep', agentId: IMPLEMENTER, label: 'Open step 2' },
      });
    },
  );

  it('says one word of the state table and at most one verb in every state it draws', () => {
    const open = JSON.parse(
      '{"id":"q-window","sessionId":"s","text":"Batch refunds?","isBlocking":true,"userAnswer":null,"status":"open","createdAt":"2026-10-16T09:00:00.000Z"}',
    );
    const pending = agentsOf({ scout: 'completed', implementer: 'pending' });
    const primaries = [
      'start-step',
      'start-run',
      'resume',
      'raise-cap',
      'review-plan',
      'approve-plan',
      'answer',
      'open-step',
      'continue',
      'retry',
      'hint',
      'decide-next',
    ] as const;
    const stops = [
      'budget',
      'failure',
      'operator',
      'paused',
      'needs-approval',
      'plan-approval',
      'preset-change',
    ] as const;
    const tails: ReadonlyArray<RunTail | null> = [
      tailOf({}),
      tailOf({ selectedRootId: SCOUT }),
      tailOf({ quiet: { agentId: IMPLEMENTER, minutes: 30 } }),
      tailOf({ agents: pending, restartStoppedCount: 2 }),
      tailOf({ agents: agentsOf({ scout: 'completed', implementer: 'stopped' }) }),
      tailOf({ run: aWorkflowRun({ orchestrationStop: { kind: 'closed', message: 'x' } }) }),
      tailOf({
        agents: pending,
        nextAction: { kind: 'summarizing', subjectAgentId: null, sentence: 'x', cause: 'x' },
      }),
      tailOf({ agents: pending, nextAction: recoverOf({ isBlocked: true }) }),
      tailOf({
        agents: agentsOf({ scout: 'completed', implementer: 'failed' }),
        selectedRootId: IMPLEMENTER,
        nextAction: recoverOf({ isBlocked: false }),
      }),
      ...primaries.flatMap((kind) =>
        [null, SCOUT].map((selectedRootId) =>
          tailOf({ agents: pending, primary: { kind, label: 'Go' }, selectedRootId }),
        ),
      ),
      ...stops.map((kind) =>
        tailOf({
          agents: pending,
          run: aWorkflowRun({ orchestrationStop: { kind, message: 'Stopped for Northwind' } }),
          question: open,
        }),
      ),
    ];

    for (const tail of tails) {
      if (tail === null) {
        continue;
      }
      expect(TAIL_WORDS.has(tail.phrase), tail.phrase).toBe(true);
    }
    expect(tails.filter((tail) => tail !== null).length).toBeGreaterThan(20);
  });

  it('reads a blocked step on its own page as Not finished and keeps Retry', () => {
    expect(
      tailOf({
        agents: agentsOf({ scout: 'completed', implementer: 'blocked' }),
        selectedRootId: IMPLEMENTER,
        nextAction: recoverOf({ isBlocked: true }),
      }),
    ).toEqual({
      state: 'needsYou',
      phrase: 'Not finished',
      stepAgentId: null,
      verb: { kind: 'recover' },
    });
  });

  it('reads a failed step on its own page as Failed, the sentence staying at the head of the page', () => {
    expect(
      tailOf({
        agents: agentsOf({ scout: 'completed', implementer: 'failed' }),
        selectedRootId: IMPLEMENTER,
        nextAction: recoverOf({ isBlocked: false }),
      }),
    ).toMatchObject({ phrase: 'Failed', verb: { kind: 'recover' } });
  });
});
