import { describe, expect, it } from 'vitest';
import { EMPTY_DURATION_HISTORY, type DurationHistory, type DurationSample } from '@goodboy/core';
import type { Agent, AgentId, MeasuredTurnSpan, Step, WorkflowRun } from '@goodboy/types';
import type { WorkTimeSource } from '../../workTreeModel/workTimeSource';
import { runTimeLeft } from './runTimeLeft';

const MINUTE = 60_000;
const NOW = Date.parse('2026-09-25T12:00:00.000Z');

const sample = (minutes: number): DurationSample => ({
  role: 'implementer',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  activeMs: minutes * MINUTE,
  costUsd: 1,
  endedAtMs: NOW - MINUTE,
});

const run = (runSample: number) => ({
  activeMs: runSample * MINUTE,
  costUsd: null,
  endedAtMs: NOW - MINUTE,
});

const HISTORY: DurationHistory = {
  ...EMPTY_DURATION_HISTORY,
  steps: [6, 8, 10, 12, 14].map(sample),
  orchestratedRuns: [20, 30, 40, 50, 60].map(run),
};

type StepParams = {
  readonly roles?: ReadonlyArray<string>;
};

const stepsOf = ({ roles = ['implementer', 'implementer', 'implementer'] }: StepParams) =>
  JSON.parse(
    JSON.stringify(
      roles.map((role, index) => ({
        id: `step-${index}`,
        role,
        providerOverride: 'anthropic',
        modelOverride: 'claude-sonnet-5',
      })),
    ),
  ) as ReadonlyArray<Step>;

const agentsOf = (statuses: ReadonlyArray<string>) =>
  JSON.parse(
    JSON.stringify(
      statuses.map((status, index) => ({
        id: `agent-${index}`,
        status,
        stepId: `step-${index}`,
        parentAgentId: null,
      })),
    ),
  ) as ReadonlyArray<Agent>;

const span = (agentId: string, from: number, to: number): MeasuredTurnSpan => ({
  agentId: agentId as AgentId,
  parentAgentId: null,
  agentStatus: 'completed',
  workflowRunId: null,
  isOrchestratedRunDone: false,
  stepRole: 'implementer',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  startedAtMs: NOW - from * MINUTE,
  endedAtMs: NOW - to * MINUTE,
  endReason: 'succeeded',
  costUsd: null,
  touchedMountIds: null,
});

const source = (over: Partial<WorkTimeSource>): WorkTimeSource => ({
  nowMs: NOW,
  spans: [],
  history: HISTORY,
  liveStartMs: new Map(),
  childrenOf: new Map(),
  ...over,
});

const STATIC_RUN = { id: 'run-1', executionMode: 'static' } as WorkflowRun;
const DYNAMIC_RUN = { id: 'run-1', executionMode: 'dynamic' } as WorkflowRun;
const ROUTING = { roleModels: null, sessionProvider: null, sessionEffort: null };

describe('runTimeLeft', () => {
  it('adds the time left on the running step to the usual time of every queued step', () => {
    const left = runTimeLeft({
      run: STATIC_RUN,
      steps: stepsOf({}),
      agents: agentsOf(['completed', 'running', 'pending']),
      source: source({ liveStartMs: new Map([['agent-1', NOW - 2 * MINUTE]]) }),
      ...ROUTING,
    });

    expect(left).toEqual({
      label: '~14-20m left',
      detail: 'Step 2 ~6-10m left, then step 3 usually 8-12m. Waiting on you is not counted.',
    });
  });

  it('gives a run that has not started its usual time', () => {
    const left = runTimeLeft({
      run: STATIC_RUN,
      steps: stepsOf({ roles: ['implementer', 'implementer'] }),
      agents: [],
      source: source({}),
      ...ROUTING,
    });

    expect(left?.label).toBe('usually 16-25m');
  });

  it('shows no total when a step left has no estimate or the running step is past its range', () => {
    expect(
      runTimeLeft({
        run: STATIC_RUN,
        steps: stepsOf({ roles: ['implementer', 'tester'] }),
        agents: agentsOf(['running', 'pending']),
        source: source({ liveStartMs: new Map([['agent-0', NOW - 2 * MINUTE]]) }),
        ...ROUTING,
      }),
    ).toBeNull();
    expect(
      runTimeLeft({
        run: STATIC_RUN,
        steps: stepsOf({}),
        agents: agentsOf(['completed', 'running', 'pending']),
        source: source({ spans: [span('agent-1', 20, 7)] }),
        ...ROUTING,
      }),
    ).toBeNull();
  });

  it('measures an orchestrated run against past orchestrated runs', () => {
    const left = runTimeLeft({
      run: DYNAMIC_RUN,
      steps: [],
      agents: agentsOf(['completed']),
      source: source({ spans: [span('agent-0', 20, 10)] }),
      ...ROUTING,
    });

    expect(left?.label).toBe('~20-40m left');
    expect(left?.detail).toBe(
      'Usually 30-50m in total. Based on 5 past orchestrated runs in this workspace, last 90 days. Waiting on you is not counted.',
    );
  });
});
