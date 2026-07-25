// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Agent, AgentId, SessionId, TelemetryRecord } from '@goodboy/types';

vi.mock('../../../../../store', () => ({
  agentHasUnread: () => false,
}));

import { WorkflowStepRow } from './WorkflowStepRow';

const SID = 'sess-1' as SessionId;

const run = {
  id: 'step-agent-1' as AgentId,
  sessionId: SID,
  ordinal: 0,
  name: 'implement the slice',
  status: 'completed',
  startedAt: '2026-05-28T00:00:00Z',
  completedAt: '2026-05-28T00:03:00Z',
} as Agent;

const telemetry = {
  runId: 'run-1',
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
  inputTokens: 10,
  outputTokens: 2,
  estimatedCostUsd: 0.3,
  recordedAt: '2026-01-01T00:00:00.000Z',
} as TelemetryRecord;

type Overrides = {
  readonly ranAlready?: boolean;
  readonly isPendingFuture?: boolean;
};

const renderRow = ({ ranAlready = true, isPendingFuture = false }: Overrides = {}) =>
  render(
    <WorkflowStepRow
      run={
        isPendingFuture
          ? ({ ...run, status: 'pending', startedAt: undefined, completedAt: undefined } as Agent)
          : run
      }
      kind="implementer"
      index={0}
      resolvedModel="claude-opus-4-5"
      isActionable={false}
      blockReason={null}
      isSelected={false}
      isTaskActive
      isEditing={false}
      telemetry={ranAlready ? telemetry : null}
      aggregate={
        ranAlready ? { inputTokens: 900, outputTokens: 90, estimatedCostUsd: 1.1, turns: 5 } : null
      }
      contextUsage={
        ranAlready
          ? [
              {
                provider: 'anthropic',
                model: 'claude-sonnet-4-5',
                inputTokens: 900,
                outputTokens: 90,
              },
            ]
          : []
      }
      turns={ranAlready ? 5 : 0}
      turnsLoading={false}
      onStart={() => undefined}
      onSelect={() => undefined}
      onRenameStart={() => undefined}
      onRenameCommit={() => undefined}
      onRenameCancel={() => undefined}
    />,
  );

afterEach(cleanup);

describe('WorkflowStepRow', () => {
  it('shows the full metric picture without being selected', () => {
    const { container } = renderRow();
    expect(screen.getByTestId('agent-metrics-inline')).toBeTruthy();
    expect(screen.getByText('sonnet 4.5')).toBeTruthy();
    expect(screen.getByText('5t')).toBeTruthy();
    expect(screen.getByText(/ctx \d+%/)).toBeTruthy();
    expect(screen.getByTitle('in: 900 tokens (cumulative)')).toBeTruthy();
    expect(container.querySelectorAll('[title*="context:"]').length).toBeGreaterThan(0);
  });

  it('prints the model and the duration exactly once', () => {
    const { container } = renderRow();
    expect(screen.getAllByText('sonnet 4.5')).toHaveLength(1);
    expect(container.querySelectorAll('[title^="in: "]')).toHaveLength(1);
    expect(screen.getAllByTitle(/^started 2026-05-28/)).toHaveLength(1);
  });

  it('names the planned model and stays quiet for a step that has not run', () => {
    renderRow({ ranAlready: false, isPendingFuture: true });
    expect(screen.getByText('opus 4.5')).toBeTruthy();
    expect(screen.getByTestId('agent-metrics-inline').className).toContain('opacity-60');
    expect(screen.queryByTestId('agent-metrics-block')).toBeNull();
  });
});
