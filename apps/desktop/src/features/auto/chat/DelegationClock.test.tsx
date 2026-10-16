// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { brandId, type AgentId, type MeasuredTurnSpan } from '@goodboy/types';
import { WorkTimeContext, type WorkTimeSource } from '../../workTreeModel/workTimeSource';
import { DelegationClock } from './DelegationClock';

const CHILD = brandId<AgentId>({ value: 'agent-implementer' });
const MINUTE_MS = 60_000;
const START = Date.parse('2026-10-16T09:00:00.000Z');

type SpanParams = {
  readonly startedAtMs: number;
  readonly endedAtMs: number;
};

const spanOf = ({ startedAtMs, endedAtMs }: SpanParams): MeasuredTurnSpan => ({
  agentId: CHILD,
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
  nowMs: START + 30 * MINUTE_MS,
  spans: [
    spanOf({ startedAtMs: START, endedAtMs: START + 2 * MINUTE_MS }),
    spanOf({ startedAtMs: START + 20 * MINUTE_MS, endedAtMs: START + 21 * MINUTE_MS }),
  ],
  history: null,
  liveStartMs: new Map(),
  childrenOf: new Map(),
};

afterEach(cleanup);

describe('DelegationClock', () => {
  it('counts the child execution only, never the wait on you between its turns', () => {
    const view = render(
      <WorkTimeContext.Provider value={SOURCE}>
        <DelegationClock agentId={CHILD} isLive={false} />
      </WorkTimeContext.Provider>,
    );

    expect(view.container.textContent).toBe('3m');
  });

  it('draws nothing without the active-time source', () => {
    const view = render(<DelegationClock agentId={CHILD} isLive={false} />);

    expect(view.container.textContent).toBe('');
  });
});
