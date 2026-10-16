// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, StepId, Workflow, WorkflowId } from '@goodboy/types';
import { aWorkflowRun, anAgent } from '@goodboy/types/testing';
import type { NextAction } from '../../../workflows/resolveNextAction';
import { runTailOf } from './runTailOf';

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

const ROLES: ReadonlyMap<AgentId, string> = new Map([
  [SCOUT, 'Scout'],
  [IMPLEMENTER, 'Implementer'],
]);

type BaseParams = Partial<Parameters<typeof runTailOf>[0]>;

const tailOf = ({ ...overrides }: BaseParams) =>
  runTailOf({
    run: aWorkflowRun({ workflowId: WORKFLOW_ID }),
    workflow: WORKFLOW,
    agents: agentsOf({ scout: 'completed', implementer: 'running' }),
    isCompleted: false,
    primary: null,
    predecessorName: 'previous',
    nextAction: NONE,
    quiet: null,
    selectedRootId: null,
    roleById: ROLES,
    restartStoppedCount: 0,
    question: null,
    ...overrides,
  });

describe('runTailOf', () => {
  it('says a paused run is paused and leaves Resume run to the header', () => {
    expect(
      tailOf({
        agents: agentsOf({ scout: 'completed', implementer: 'pending' }),
        primary: { kind: 'resume', label: 'Resume' },
      }),
    ).toEqual({ state: 'stopped', phrase: 'Paused by you', startedAt: null, verb: null });
  });

  it('stays silent while the step on screen runs, since its own line speaks', () => {
    expect(tailOf({ selectedRootId: IMPLEMENTER })).toBeNull();
  });

  it('points at the running step from any other entry', () => {
    expect(tailOf({ selectedRootId: SCOUT })).toMatchObject({
      state: 'working',
      phrase: 'Step 2 · Implementer is working',
      verb: { kind: 'openStep', agentId: IMPLEMENTER, label: 'Open step 2' },
    });
  });

  it('offers Ask it to continue after a quiet stretch', () => {
    expect(tailOf({ quiet: { agentId: IMPLEMENTER, minutes: 15 } })).toMatchObject({
      phrase: 'No output for 15 min',
      verb: { kind: 'quiet', agentId: IMPLEMENTER },
    });
  });

  it('offers Resume all for agents a restart stopped', () => {
    expect(
      tailOf({
        agents: agentsOf({ scout: 'completed', implementer: 'stopped' }),
        restartStoppedCount: 2,
      }),
    ).toMatchObject({
      phrase: '2 agents stopped when Goodboy closed',
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
      phrase: 'Step 1 done · ready to continue',
      verb: { kind: 'primary', primary: { kind: 'start-step' } },
    });
  });

  it('says a queued run waits to start, or names the run it follows', () => {
    const primary = { kind: 'start-run', label: 'Start run' } as const;
    const agents = agentsOf({ scout: 'pending', implementer: 'pending' });
    expect(tailOf({ agents, primary })?.phrase).toBe('Waits to start');
    expect(
      tailOf({
        agents,
        primary,
        run: aWorkflowRun({ triggerMode: 'after_run' }),
        predecessorName: 'Write the docs',
      })?.phrase,
    ).toBe('Starts after Write the docs');
  });

  it('asks to raise the cap when the run stopped at it', () => {
    expect(
      tailOf({
        agents: agentsOf({ scout: 'completed', implementer: 'pending' }),
        run: aWorkflowRun({ orchestrationStop: { kind: 'budget', message: 'Paused' } }),
      }),
    ).toMatchObject({ state: 'paused', verb: { kind: 'raiseCap' } });
  });

  it('offers Continue step on a step you stopped', () => {
    expect(
      tailOf({ agents: agentsOf({ scout: 'completed', implementer: 'stopped' }) }),
    ).toMatchObject({
      phrase: 'Step 2 · Implementer stopped',
      verb: { kind: 'continueStep', agentId: IMPLEMENTER },
    });
  });

  it('ends a finished or a stopped run without a verb, the rail Add step is its home', () => {
    expect(tailOf({ isCompleted: true })).toMatchObject({
      phrase: 'Run finished',
      verb: null,
    });
    expect(
      tailOf({ run: aWorkflowRun({ orchestrationStop: { kind: 'closed', message: 'Closed' } }) }),
    ).toMatchObject({ phrase: 'Stopped by you', verb: null });
  });

  it('draws no tail on an archived run, whose Restore is in the header', () => {
    expect(
      tailOf({ run: aWorkflowRun({ discardedAt: JSON.parse('"2026-10-16T10:00:00.000Z"') }) }),
    ).toBeNull();
  });
});
