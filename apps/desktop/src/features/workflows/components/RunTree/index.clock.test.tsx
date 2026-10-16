// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { brandId, type AgentId, type MeasuredTurnSpan } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { TailLine } from '../../../live-state/TailLine';
import { WorkTimeContext, type WorkTimeSource } from '../../../workTreeModel/workTimeSource';
import { RunTreeHarness } from './testing/RunTreeHarness';
import { SESSION_ID, WORKSPACE_ID, baseAgents, workflow } from './testing/runTreeFixtures';

const IMPLEMENT = brandId<AgentId>({ value: 'implement' });
const MINUTE_MS = 60_000;
const FIRST_TURN_START = Date.parse('2026-08-18T09:02:00.000Z');
const FIRST_TURN_END = FIRST_TURN_START + MINUTE_MS;
const WAIT_ON_YOU_MS = 7 * MINUTE_MS;
const SECOND_TURN_START = FIRST_TURN_END + WAIT_ON_YOU_MS;
const NOW = SECOND_TURN_START + 30_000;

const spanOf = ({
  startedAtMs,
  endedAtMs,
}: {
  readonly startedAtMs: number;
  readonly endedAtMs: number;
}): MeasuredTurnSpan => ({
  agentId: IMPLEMENT,
  parentAgentId: null,
  agentStatus: null,
  workflowRunId: null,
  isOrchestratedRunDone: false,
  stepRole: 'implementer',
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: null,
  startedAtMs,
  endedAtMs,
  endReason: 'succeeded',
  costUsd: null,
  touchedMountIds: null,
});

const SOURCE: WorkTimeSource = {
  nowMs: NOW,
  spans: [spanOf({ startedAtMs: FIRST_TURN_START, endedAtMs: FIRST_TURN_END })],
  history: null,
  liveStartMs: new Map([[IMPLEMENT, SECOND_TURN_START]]),
  childrenOf: new Map(),
};

beforeEach(() => {
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION_ID]: [...baseAgents] },
    phaseTemplates: { [WORKSPACE_ID]: [workflow] },
    sessionOpenQuestions: { [SESSION_ID]: [] },
    sessionTelemetry: {},
    agentRunHistory: {},
    sessionWorkflows: {},
    sessionPlans: {},
    orchestratingWorkflowRuns: {},
    agentTurnState: {},
  });
});

afterEach(cleanup);

describe('run clock', () => {
  it('shows the same active time in the step row and in the tail, without the wait on you', () => {
    render(<RunTreeHarness source={SOURCE} />);
    render(
      <WorkTimeContext.Provider value={SOURCE}>
        <TailLine
          facts={{
            state: 'working',
            phrase: 'Step 2 · Implementer is working',
            startedAt: null,
            stepAgentId: IMPLEMENT,
            actions: [],
          }}
          onAction={() => undefined}
        />
      </WorkTimeContext.Provider>,
    );

    const rowClock = within(screen.getByTestId('run-tree-row-implement')).getByTestId(
      'work-time',
    ).textContent;
    const tail = document.querySelector<HTMLElement>('[data-tail]');
    if (tail === null) {
      throw new Error('no tail');
    }

    expect(rowClock).toBe('1m 30s');
    expect(within(tail).getByText('1m 30s')).toBeDefined();
    expect(within(tail).queryByText('8m 30s')).toBeNull();
  });

  it('draws no tail clock without the active-time source rather than wall time', () => {
    render(
      <TailLine
        facts={{
          state: 'working',
          phrase: 'Step 2 · Implementer is working',
          startedAt: null,
          stepAgentId: IMPLEMENT,
          actions: [],
        }}
        onAction={() => undefined}
      />,
    );

    expect(document.querySelector('[data-tail] .tabular-nums')).toBeNull();
  });
});
