// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Agent, AgentId, SessionId, TelemetryRecord } from '@goodboy/types';

vi.mock('../../../../../store', () => ({
  agentHasUnread: () => false,
}));

vi.mock('../../../../session/components/ForceResolveAction', () => ({
  ForceResolveAction: () => null,
}));

vi.mock('../../../../session/components/ForceCloseResolverAction', () => ({
  ForceCloseResolverAction: () => null,
}));

import { ResolveClusterRow } from './ResolveClusterRow';

const SID = 'sess-1' as SessionId;

const agent = {
  id: 'resolver-1' as AgentId,
  sessionId: SID,
  ordinal: 0,
  name: 'resolve comment 12',
  status: 'completed',
  startedAt: '2026-05-28T00:00:00Z',
  completedAt: '2026-05-28T00:01:00Z',
} as Agent;

const telemetry = {
  runId: 'run-1',
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-haiku-4-5',
  inputTokens: 10,
  outputTokens: 2,
  estimatedCostUsd: 0.05,
  recordedAt: '2026-01-01T00:00:00.000Z',
} as TelemetryRecord;

const renderRow = () =>
  render(
    <ResolveClusterRow
      agent={agent}
      index={0}
      total={2}
      status="done"
      threadComment={null}
      diffComment={null}
      telemetry={telemetry}
      aggregate={{ inputTokens: 400, outputTokens: 40, estimatedCostUsd: 0.75, turns: 2 }}
      contextUsage={[
        { provider: 'anthropic', model: 'claude-haiku-4-5', inputTokens: 50_000, outputTokens: 0 },
      ]}
      turns={2}
      turnsLoading={false}
      isSelected={false}
      isTaskActive
      canJump={false}
      onSelect={() => undefined}
      onJump={() => undefined}
      onResolveThread={() => undefined}
    />,
  );

afterEach(cleanup);

describe('ResolveClusterRow', () => {
  it('shows model, cost, context share and turns without being selected', () => {
    renderRow();
    expect(screen.getByTestId('agent-metrics-inline')).toBeTruthy();
    expect(screen.getByText('haiku 4.5')).toBeTruthy();
    expect(screen.getByText('2t')).toBeTruthy();
    expect(screen.getByText(/ctx \d+%/)).toBeTruthy();
  });

  it('shows the token split, duration and context gauge without being selected', () => {
    const { container } = renderRow();
    expect(screen.getByTestId('agent-metrics-block')).toBeTruthy();
    expect(screen.getByTitle('in: 400 tokens (cumulative)')).toBeTruthy();
    expect(screen.getByTitle('out: 40 tokens (cumulative)')).toBeTruthy();
    expect(screen.getByTitle(/^started 2026-05-28/)).toBeTruthy();
    expect(container.querySelectorAll('[title*="context:"]').length).toBeGreaterThan(0);
  });

  it('prints cost, turns and duration exactly once', () => {
    const { container } = renderRow();
    expect(container.querySelectorAll('[title^="in: "]')).toHaveLength(1);
    expect(container.querySelectorAll('[title^="out: "]')).toHaveLength(1);
    expect(screen.getAllByText('2t')).toHaveLength(1);
    expect(screen.getAllByTitle(/^started 2026-05-28/)).toHaveLength(1);
  });

  it('keeps the resolver name and position readable alongside the metrics', () => {
    renderRow();
    expect(screen.getByText('resolve comment 12')).toBeTruthy();
    expect(screen.getByText('1/2')).toBeTruthy();
  });
});
