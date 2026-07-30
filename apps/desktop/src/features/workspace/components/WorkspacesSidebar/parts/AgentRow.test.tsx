// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Agent, AgentId, AgentStatus, SessionId, TelemetryRecord } from '@goodboy/types';

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

const markDone = vi.fn();
const remove = vi.fn();
const inspect = vi.fn();

const renderRow = (isSelected: boolean, runOverride: Partial<Agent> = {}) =>
  render(
    <ul>
      <AgentRow
        run={{ ...run, ...runOverride }}
        kind="scout"
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
        onDelete={remove}
        onInspect={inspect}
        onMarkDone={markDone}
      />
    </ul>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AgentRow', () => {
  it('shows model, cost, context share and turns without being selected', () => {
    renderRow(false);
    expect(screen.getByTestId('agent-metrics-inline')).toBeTruthy();
    expect(screen.getByText('Sonnet 4.5')).toBeTruthy();
    expect(screen.getByText('3t')).toBeTruthy();
    expect(screen.getByText(/ctx \d+%/)).toBeTruthy();
  });

  it('shows the token split and the duration without being selected', () => {
    renderRow(false);
    expect(screen.getByTestId('agent-metrics-block')).toBeTruthy();
    expect(screen.getByTitle('in: 100 tokens (cumulative)')).toBeTruthy();
    expect(screen.getByTitle('out: 20 tokens (cumulative)')).toBeTruthy();
    expect(screen.getByTitle(/^started .+2026/)).toBeTruthy();
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
    expect(screen.getAllByTitle(/^started .+2026/)).toHaveLength(1);
  });

  it('shows the same metrics when selected', () => {
    renderRow(true);
    expect(screen.getByText('Sonnet 4.5')).toBeTruthy();
    expect(screen.getAllByTestId('agent-metrics-inline')).toHaveLength(1);
    expect(screen.getAllByTestId('agent-metrics-block')).toHaveLength(1);
  });

  it.each<AgentStatus>(['pending', 'running', 'completed', 'failed', 'skipped'])(
    'shows the %s status icon before the agent name',
    (status) => {
      renderRow(false, { status });
      expect(screen.getByText('scout one').previousElementSibling?.getAttribute('title')).toBe(
        status,
      );
      expect(screen.queryByText(status)).toBeNull();
    },
  );

  it('offers mark done for a stopped standalone agent', () => {
    renderRow(false);
    fireEvent.click(screen.getByRole('button', { name: 'mark agent done' }));
    expect(markDone).toHaveBeenCalledOnce();
  });

  it('hides mark done while the agent is running', () => {
    renderRow(false, { status: 'running' });
    expect(screen.queryByRole('button', { name: 'mark agent done' })).toBeNull();
  });

  it('keeps the row actions mounted at rest and reveals them by opacity', () => {
    renderRow(false);
    const remove = screen.getByRole('button', { name: 'delete agent' });
    const done = screen.getByRole('button', { name: 'mark agent done' });

    expect(remove.className).toContain('opacity-0');
    expect(remove.className).toContain('group-hover/agent-card:opacity-100');
    expect(remove.className).toContain('group-focus-within/agent-card:opacity-100');
    expect(remove.className).not.toContain('hidden');
    expect(done.className).not.toContain('hidden');
    expect(screen.getByRole('button', { name: 'Toggle agent details' })).toBeTruthy();
  });

  it('arms the delete confirm without resizing the action slot', () => {
    renderRow(false);
    const slot = screen.getByRole('group', { name: 'agent actions' });
    const before = slot.className;

    fireEvent.click(screen.getByRole('button', { name: 'delete agent' }));

    const panel = screen.getByRole('group', { name: 'Delete agent?' });
    expect(within(panel).getByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'agent actions' }).className).toBe(before);
  });

  it('deletes only after the confirm step', () => {
    renderRow(false);
    fireEvent.click(screen.getByRole('button', { name: 'delete agent' }));
    expect(remove).not.toHaveBeenCalled();

    const panel = screen.getByRole('group', { name: 'Delete agent?' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Delete' }));
    expect(remove).toHaveBeenCalledOnce();
  });
});

describe('AgentRow numbering', () => {
  afterEach(cleanup);

  it('numbers the row by creation order, not by its position in the list', () => {
    renderRow(false, { ordinal: 14 });
    expect(screen.getByText('15.')).toBeDefined();
  });

  it('keeps the badge and the row tooltip on the same number', () => {
    renderRow(false, { ordinal: 3 });
    expect(screen.getByText('4.')).toBeDefined();
    expect(screen.getAllByTitle(/agent 4/).length).toBeGreaterThan(0);
  });
});
