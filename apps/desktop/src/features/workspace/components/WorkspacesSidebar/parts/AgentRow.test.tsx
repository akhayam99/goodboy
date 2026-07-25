// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Agent, AgentId, SessionId, TelemetryRecord } from '@goodboy/types';

vi.mock('../../../../../store', () => ({
  agentHasUnread: () => false,
}));

import { AgentRow } from './AgentRow';

const SID = 'sess-1' as SessionId;

const run = {
  id: 'agent-1' as AgentId,
  sessionId: SID,
  ordinal: 0,
  name: 'scout one',
  status: 'completed',
  startedAt: '2026-05-28T00:00:00Z',
  completedAt: '2026-05-28T00:02:00Z',
} as Agent;

const telemetry = {
  runId: 'run-1',
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
  inputTokens: 10,
  outputTokens: 2,
  estimatedCostUsd: 0.25,
  recordedAt: '2026-01-01T00:00:00.000Z',
} as TelemetryRecord;

const renderRow = (isSelected: boolean) =>
  render(
    <ul>
      <AgentRow
        run={run}
        kind="scout"
        index={0}
        telemetry={telemetry}
        aggregate={{ inputTokens: 100, outputTokens: 20, estimatedCostUsd: 1.5, turns: 3 }}
        contextUsage={[
          {
            provider: 'anthropic',
            model: 'claude-sonnet-4-5',
            inputTokens: 100_000,
            outputTokens: 0,
          },
        ]}
        turns={3}
        turnsLoading={false}
        isSelected={isSelected}
        isTaskActive
        isEditing={false}
        onClick={() => undefined}
        onRenameStart={() => undefined}
        onRenameCommit={() => undefined}
        onRenameCancel={() => undefined}
        onDelete={() => undefined}
      />
    </ul>,
  );

afterEach(cleanup);

describe('AgentRow', () => {
  it('shows model, cost, context share and turns without being selected', () => {
    renderRow(false);
    expect(screen.getByTestId('agent-metrics-inline')).toBeTruthy();
    expect(screen.getByText('sonnet 4.5')).toBeTruthy();
    expect(screen.getByText('3t')).toBeTruthy();
    expect(screen.getByText(/ctx \d+%/)).toBeTruthy();
  });

  it('shows the token split and the duration without being selected', () => {
    renderRow(false);
    expect(screen.getByTestId('agent-metrics-block')).toBeTruthy();
    expect(screen.getByTitle('in: 100 tokens (cumulative)')).toBeTruthy();
    expect(screen.getByTitle('out: 20 tokens (cumulative)')).toBeTruthy();
    expect(screen.getByTitle(/^started 2026-05-28/)).toBeTruthy();
  });

  it('shows the per-provider context gauge without being selected', () => {
    const { container } = renderRow(false);
    expect(container.querySelectorAll('[title*="context:"]').length).toBeGreaterThan(0);
  });

  it('prints cost, turns and duration exactly once', () => {
    const { container } = renderRow(false);
    expect(container.querySelectorAll('[title^="in: "]')).toHaveLength(1);
    expect(container.querySelectorAll('[title^="out: "]')).toHaveLength(1);
    expect(screen.getAllByText('3t')).toHaveLength(1);
    expect(screen.getAllByTitle(/^started 2026-05-28/)).toHaveLength(1);
  });

  it('shows the same metrics when selected', () => {
    renderRow(true);
    expect(screen.getByText('sonnet 4.5')).toBeTruthy();
    expect(screen.getAllByTestId('agent-metrics-inline')).toHaveLength(1);
    expect(screen.getAllByTestId('agent-metrics-block')).toHaveLength(1);
  });
});
