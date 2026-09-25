import { describe, expect, it } from 'vitest';
import { EMPTY_DURATION_HISTORY, type DurationHistory, type DurationSample } from '@goodboy/core';
import type { AgentId, MeasuredTurnSpan } from '@goodboy/types';
import type { WorkTimeSource } from '../../workTreeModel/workTimeSource';
import type { TimelineRunEntry } from './buildTimelineGroups';
import { runWorkTime } from './runWorkTime';

const MINUTE = 60_000;
const NOW = Date.parse('2026-09-25T12:00:00.000Z');

type EntryParams = {
  readonly statuses: ReadonlyArray<string>;
  readonly executionMode?: 'static' | 'dynamic';
};

const entryOf = ({ statuses, executionMode = 'static' }: EntryParams): TimelineRunEntry =>
  JSON.parse(
    JSON.stringify({
      kind: 'run',
      run: { id: 'run-1', executionMode },
      workflow: {
        steps: statuses.map((_, index) => ({
          id: `step-${index}`,
          role: 'implementer',
          providerOverride: 'anthropic',
          modelOverride: 'claude-sonnet-5',
        })),
      },
      children: statuses.map((status, index) => ({
        kind: 'agent',
        agentKind: 'implementer',
        children: [],
        agent: { id: `agent-${index}`, status, stepId: `step-${index}` },
      })),
    }),
  );

const sample = (minutes: number): DurationSample => ({
  role: 'implementer',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  activeMs: minutes * MINUTE,
  costUsd: 1,
  endedAtMs: NOW - MINUTE,
});

const HISTORY: DurationHistory = {
  ...EMPTY_DURATION_HISTORY,
  steps: [6, 8, 10, 12, 14].map(sample),
  orchestratedRuns: [],
};

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

const ROUTING = { roleModels: null, sessionProvider: null, sessionEffort: null };

describe('runWorkTime', () => {
  it('adds what finished steps took to the usual time of the steps left', () => {
    const time = runWorkTime({
      entry: entryOf({ statuses: ['completed', 'running', 'pending'] }),
      phase: 'running',
      source: source({
        spans: [span('agent-0', 20, 15)],
        liveStartMs: new Map([['agent-1', NOW - 2 * MINUTE]]),
      }),
      ...ROUTING,
    });

    expect(time?.label).toBe('7m of ~30m');
    expect(time?.progress).toBeCloseTo(7 / 29);
  });

  it('shows only active time when a step left has no estimate or the run is orchestrated', () => {
    const noHistory = runWorkTime({
      entry: entryOf({ statuses: ['completed', 'running'] }),
      phase: 'running',
      source: source({
        history: EMPTY_DURATION_HISTORY,
        spans: [span('agent-0', 5, 1)],
      }),
      ...ROUTING,
    });
    expect(noHistory).toMatchObject({ label: '4m', progress: null });

    const orchestrated = runWorkTime({
      entry: entryOf({ statuses: ['completed', 'running'], executionMode: 'dynamic' }),
      phase: 'running',
      source: source({ spans: [span('agent-0', 5, 1)] }),
      ...ROUTING,
    });
    expect(orchestrated).toMatchObject({ label: '4m', progress: null });
  });

  it('gives a queued run the band of its steps', () => {
    const time = runWorkTime({
      entry: entryOf({ statuses: ['pending', 'pending'] }),
      phase: 'queued',
      source: source({}),
      ...ROUTING,
    });

    expect(time?.label).toBe('~16-25m');
  });
});
