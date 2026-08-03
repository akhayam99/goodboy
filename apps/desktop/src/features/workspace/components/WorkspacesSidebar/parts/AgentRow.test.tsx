// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Agent, AgentId, AgentStatus, SessionId, TelemetryRecord } from '@goodboy/types';

const { hoverState, markAgentSeen } = vi.hoisted(() => ({
  hoverState: { hasUnread: false },
  markAgentSeen: vi.fn(async () => undefined),
}));

vi.mock('../../../../../store', () => {
  const useAppStore = Object.assign(() => undefined, {
    getState: () => ({ markAgentSeen }),
  });
  return {
    agentHasUnread: () => hoverState.hasUnread,
    useAppStore,
  };
});

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
  cachedInputTokens: 20,
  cacheCreationInputTokens: 30,
  contextTokens: 62,
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
            contextTokens: 100_000,
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
  vi.useRealTimers();
  hoverState.hasUnread = false;
});

describe('AgentRow', () => {
  it('shows model, cost, context share and turns without being selected', () => {
    renderRow(false);
    expect(screen.getByTestId('agent-metrics-inline')).toBeTruthy();
    expect(screen.getByText('Sonnet 4.5')).toBeTruthy();
    expect(screen.getByText('3t')).toBeTruthy();
    expect(screen.getByText(/ctx \d+%/)).toBeTruthy();
  });

  it('keeps duration and last update on the one fact line', () => {
    const meta = within(renderRow(false).getByTestId('agent-metrics-inline'));
    expect(meta.getByTitle(/^started .+2026/)).toBeTruthy();
    expect(meta.getByText(/^updated /)).toBeTruthy();
  });

  it('leaves the token split and the context gauge to the inspector', () => {
    const { container } = renderRow(false);
    expect(screen.queryByTestId('agent-metrics-block')).toBeNull();
    expect(screen.queryByTitle('in: 100 tokens (cumulative)')).toBeNull();
    expect(container.querySelector('[title*="last turn context:"]')).toBeNull();
  });

  it('includes cache tokens in the last-turn tooltip total', () => {
    renderRow(false);
    expect(screen.getAllByTitle(/last turn: 62 tokens/).length).toBeGreaterThan(0);
  });

  it('prints cost, turns and duration exactly once', () => {
    renderRow(false);
    expect(screen.getAllByText('3t')).toHaveLength(1);
    expect(screen.getAllByTitle(/^started .+2026/)).toHaveLength(1);
    expect(screen.getAllByText(/^updated /)).toHaveLength(1);
  });

  it('shows the same metrics when selected', () => {
    renderRow(true);
    expect(screen.getByText('Sonnet 4.5')).toBeTruthy();
    expect(screen.getAllByTestId('agent-metrics-inline')).toHaveLength(1);
    expect(screen.queryByTestId('agent-metrics-block')).toBeNull();
  });

  it('marks an unread row seen after the hover dwell', () => {
    vi.useFakeTimers();
    hoverState.hasUnread = true;
    const { container } = renderRow(false);
    const rowElement = container.querySelector('li');
    expect(rowElement).not.toBeNull();
    if (rowElement == null) {
      return;
    }

    fireEvent.mouseEnter(rowElement);
    vi.advanceTimersByTime(450);

    expect(markAgentSeen).toHaveBeenCalledWith(SID, run.id);
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
    const details = screen.getByRole('button', { name: 'Toggle agent details' });
    const navigationSlot = screen.getByRole('group', { name: 'Agent navigation actions' });
    const lifecycleSlot = screen.getByRole('group', { name: 'Agent lifecycle actions' });

    expect(remove.className).toContain('opacity-0');
    expect(remove.className).toContain('group-hover/agent-card:opacity-100');
    expect(remove.className).toContain('group-focus-within/agent-card:opacity-100');
    expect(remove.className).not.toContain('hidden');
    expect(done.className).not.toContain('hidden');
    expect(details.className).not.toContain('opacity-0');
    expect(navigationSlot.contains(details)).toBe(true);
    expect(lifecycleSlot.contains(done)).toBe(true);
    expect(lifecycleSlot.contains(remove)).toBe(true);
  });

  it('arms delete without moving the navigation or lifecycle slots', () => {
    renderRow(false);
    const navigationSlot = screen.getByRole('group', { name: 'Agent navigation actions' });
    const lifecycleSlot = screen.getByRole('group', { name: 'Agent lifecycle actions' });
    const card = navigationSlot.parentElement;
    expect(card).not.toBeNull();
    if (card == null) {
      return;
    }
    const navigationIndex = Array.from(card.children).indexOf(navigationSlot);
    const lifecycleIndex = Array.from(card.children).indexOf(lifecycleSlot);

    expect(navigationIndex).toBeGreaterThanOrEqual(0);
    expect(lifecycleIndex).toBeGreaterThan(navigationIndex);
    expect(screen.queryByRole('group', { name: 'Delete agent?' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'delete agent' }));

    const panel = screen.getByRole('group', { name: 'Delete agent?' });
    const armedNavigationSlot = screen.getByRole('group', { name: 'Agent navigation actions' });
    const armedLifecycleSlot = screen.getByRole('group', { name: 'Agent lifecycle actions' });
    expect(within(panel).getByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(armedNavigationSlot.parentElement).toBe(card);
    expect(armedLifecycleSlot.parentElement).toBe(card);
    expect(Array.from(card.children).indexOf(armedNavigationSlot)).toBe(navigationIndex);
    expect(Array.from(card.children).indexOf(armedLifecycleSlot)).toBe(lifecycleIndex);
    expect(card.contains(panel)).toBe(false);
    expect(panel.parentElement).toBe(card.parentElement);
    expect(panel.previousElementSibling).toBe(card);
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
