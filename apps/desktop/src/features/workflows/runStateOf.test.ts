// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Agent, StepId, Workflow, WorkflowId, WorkflowRun } from '@goodboy/types';
import { aWorkflowRun, anAgent } from '@goodboy/types/testing';
import { runGlanceOf } from '../session/glance/runGlanceOf';
import type { RunPrimaryKind } from './runPrimaryOf';
import {
  runStateFromKind,
  runStateOf,
  runStateOfPrimary,
  type RunState,
  type RunStateKind,
} from './runStateOf';

type Expected = Pick<RunState, 'word' | 'pageWord' | 'tone' | 'primary' | 'isNeedsYou' | 'wait'>;

const ROWS: Readonly<Record<RunStateKind, Expected>> = {
  archived: {
    word: 'Archived',
    pageWord: 'Archived',
    tone: 'idle',
    primary: 'restore',
    isNeedsYou: false,
    wait: null,
  },
  closed: {
    word: 'Stopped',
    pageWord: 'Stopped',
    tone: 'idle',
    primary: null,
    isNeedsYou: false,
    wait: null,
  },
  done: {
    word: 'Done',
    pageWord: 'Done',
    tone: 'done',
    primary: null,
    isNeedsYou: false,
    wait: null,
  },
  paused: {
    word: 'Paused',
    pageWord: 'Paused',
    tone: 'idle',
    primary: 'resume',
    isNeedsYou: false,
    wait: null,
  },
  'plan-hold': {
    word: 'Needs approval',
    pageWord: 'Needs approval',
    tone: 'needsYou',
    primary: null,
    isNeedsYou: true,
    wait: null,
  },
  'plan-revising': {
    word: 'Running',
    pageWord: 'Running',
    tone: 'running',
    primary: null,
    isNeedsYou: false,
    wait: null,
  },
  stopping: {
    word: 'Stopping',
    pageWord: 'Stopping',
    tone: 'running',
    primary: null,
    isNeedsYou: false,
    wait: null,
  },
  stopped: {
    word: 'Stopped',
    pageWord: 'Stopped',
    tone: 'idle',
    primary: 'continue',
    isNeedsYou: false,
    wait: null,
  },
  limit: {
    word: 'Paused at the limit',
    pageWord: 'Paused at the limit',
    tone: 'needsYou',
    primary: 'raise-cap',
    isNeedsYou: true,
    wait: 'limit',
  },
  'failed-stop': {
    word: 'Failed',
    pageWord: 'Failed',
    tone: 'failed',
    primary: 'retry',
    isNeedsYou: false,
    wait: 'stopped',
  },
  failed: {
    word: 'Failed',
    pageWord: 'Failed',
    tone: 'failed',
    primary: 'retry',
    isNeedsYou: false,
    wait: null,
  },
  running: {
    word: 'Running',
    pageWord: 'Running',
    tone: 'running',
    primary: null,
    isNeedsYou: false,
    wait: null,
  },
  question: {
    word: 'Needs you',
    pageWord: 'Needs you',
    tone: 'needsYou',
    primary: 'answer',
    isNeedsYou: true,
    wait: null,
  },
  'halted-blocked': {
    word: 'Not finished',
    pageWord: 'Needs you',
    tone: 'needsYou',
    primary: 'open-step',
    isNeedsYou: true,
    wait: 'stopped',
  },
  'halted-failed': {
    word: 'Failed',
    pageWord: 'Needs you',
    tone: 'failed',
    primary: 'open-step',
    isNeedsYou: false,
    wait: 'stopped',
  },
  'after-run': {
    word: 'After previous',
    pageWord: 'After previous',
    tone: 'idle',
    primary: null,
    isNeedsYou: false,
    wait: null,
  },
  ready: {
    word: 'Ready',
    pageWord: 'Ready',
    tone: 'idle',
    primary: null,
    isNeedsYou: false,
    wait: null,
  },
  'waits-go': {
    word: 'Needs you',
    pageWord: 'Needs you',
    tone: 'needsYou',
    primary: 'decide-next',
    isNeedsYou: true,
    wait: 'go',
  },
};

const KINDS: ReadonlyArray<RunStateKind> = [
  'archived',
  'closed',
  'done',
  'paused',
  'plan-hold',
  'plan-revising',
  'stopping',
  'stopped',
  'limit',
  'failed-stop',
  'failed',
  'running',
  'question',
  'halted-blocked',
  'halted-failed',
  'after-run',
  'ready',
  'waits-go',
];

const PRIMARIES = [
  'review-plan',
  'approve-plan',
  'answer',
  'resume',
  'continue',
  'retry',
  'hint',
  'raise-cap',
  'decide-next',
  'start-step',
  'open-step',
  'start-run',
  'restore',
] as const satisfies ReadonlyArray<RunPrimaryKind>;

describe('runStateOf', () => {
  it('lists every kind of the table', () => {
    expect([...KINDS].sort()).toEqual(Object.keys(ROWS).sort());
  });

  it.each(KINDS)('reads %s as one word, tone, primary and wait', (kind) => {
    expect(runStateFromKind({ kind })).toMatchObject(ROWS[kind]);
  });

  it('names the run it follows', () => {
    expect(runStateFromKind({ kind: 'after-run', predecessorName: 'Export ledger' }).word).toBe(
      'After Export ledger',
    );
  });

  it('keeps a halted step, blocked or failed, on the run page as the one word Needs you', () => {
    for (const kind of ['halted-blocked', 'halted-failed'] as const) {
      expect(runStateFromKind({ kind }).pageWord).toBe('Needs you');
      expect(runStateFromKind({ kind }).primary).toBe('open-step');
    }
  });

  it.each([
    ['answer', 'question'],
    ['open-step', 'halted-blocked'],
    ['raise-cap', 'limit'],
    ['retry', 'failed'],
    ['continue', 'stopped'],
  ] as const)('maps the %s primary to the %s state', (primary, kind) => {
    expect(runStateOfPrimary({ primary }).kind).toBe(kind);
  });

  it.each(PRIMARIES)(
    'lets the glance of the %s primary wait only when the run needs you',
    (primary) => {
      const glance = runGlanceOf({
        isDiscarded: false,
        isCompleted: false,
        isDynamic: true,
        doneCount: 1,
        stepCount: 0,
        primary,
      });

      if (glance.state === 'waiting') {
        expect(runStateOfPrimary({ primary }).isNeedsYou).toBe(true);
      }
    },
  );

  describe('a failure stop', () => {
    const WORKFLOW_ID: WorkflowId = JSON.parse('"workflow-ledger-export"');
    const STOP = { kind: 'failure', message: 'The step failed' } as const;

    const workflow: Workflow = {
      id: WORKFLOW_ID,
      workspaceId: JSON.parse('"workspace-harborline"'),
      name: 'Export ledger',
      description: '',
      steps: [0, 1].map((index) => ({
        id: JSON.parse(`"step-${index}"`),
        workflowId: WORKFLOW_ID,
        ordinal: index,
        name: `Step ${index + 1}`,
        promptPrefix: '',
      })),
      createdAt: JSON.parse('"2026-10-16T09:00:00.000Z"'),
      updatedAt: JSON.parse('"2026-10-16T09:00:00.000Z"'),
    };

    const at = (hour: number) =>
      JSON.parse(`"2026-10-16T${String(hour).padStart(2, '0')}:00:00.000Z"`);

    type AgentParams = {
      readonly id: string;
      readonly step: number;
      readonly status: Agent['status'];
      readonly hour: number;
    };

    const agentOf = ({ id, step, status, hour }: AgentParams): Agent => {
      const stepId: StepId = JSON.parse(`"step-${step}"`);
      return anAgent({
        id: JSON.parse(`"${id}"`),
        stepId,
        status,
        ordinal: hour,
        completedAt: at(hour),
      });
    };

    type StateParams = {
      readonly run?: Partial<WorkflowRun>;
      readonly agents: ReadonlyArray<Agent>;
    };

    const kindOf = ({ run = {}, agents }: StateParams): RunStateKind =>
      runStateOf({
        run: aWorkflowRun({ workflowId: WORKFLOW_ID, orchestrationStop: STOP, ...run }),
        workflow,
        agents,
        predecessorName: 'previous',
        isOrchestrating: false,
        questions: [],
        isPlanRevising: false,
      }).kind;

    const FAILED = agentOf({ id: 'a1', step: 0, status: 'failed', hour: 8 });

    it('stays stopped while the stop is set and the step is not retried', () => {
      expect(kindOf({ agents: [FAILED] })).toBe('failed-stop');
    });

    it('ends when the stop clears', () => {
      expect(kindOf({ run: { orchestrationStop: undefined }, agents: [FAILED] })).toBe(
        'halted-failed',
      );
    });

    it('ends when the same step is retried and completes', () => {
      const retried = agentOf({ id: 'a2', step: 0, status: 'completed', hour: 9 });
      expect(kindOf({ agents: [FAILED, retried] })).not.toBe('failed-stop');
      expect(kindOf({ run: { orchestrationStop: undefined }, agents: [FAILED, retried] })).not.toBe(
        'halted-failed',
      );
    });

    it('stays stopped when another step of the same run completed', () => {
      const later = agentOf({ id: 'a2', step: 1, status: 'completed', hour: 9 });
      expect(kindOf({ agents: [FAILED, later] })).toBe('failed-stop');
    });

    it('stays stopped when a retry of the step has not completed', () => {
      const pending = agentOf({ id: 'a2', step: 0, status: 'pending', hour: 9 });
      expect(kindOf({ agents: [FAILED, pending] })).toBe('failed-stop');
    });

    it('stays stopped in this run when the same step succeeded in another run', () => {
      const own = anAgent({ ...FAILED, workflowRunId: JSON.parse('"run-ledger-a"') });
      const other = anAgent({
        ...agentOf({ id: 'a3', step: 0, status: 'completed', hour: 9 }),
        workflowRunId: JSON.parse('"run-ledger-b"'),
      });
      expect(kindOf({ agents: [own, other] })).toBe('failed-stop');
    });
  });
});
