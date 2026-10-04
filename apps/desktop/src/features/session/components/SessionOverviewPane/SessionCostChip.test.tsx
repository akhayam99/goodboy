// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  Agent,
  ProviderRunId,
  SessionBudget,
  SessionId,
  TelemetryRecord,
} from '@goodboy/types';

type Store = {
  sessionTelemetry: Readonly<Record<string, ReadonlyArray<TelemetryRecord>>>;
  sessionPhaseRuns: Readonly<Record<string, ReadonlyArray<Agent>>>;
  agentRunHistory: Readonly<Record<string, ReadonlyArray<ProviderRunId>>>;
  agentKindOverride: Readonly<Record<string, string>>;
  sessionBudgets: Readonly<Record<string, SessionBudget>>;
  loadSessionTelemetry: ReturnType<typeof vi.fn>;
  loadSessionBudget: ReturnType<typeof vi.fn>;
  setSessionBudget: ReturnType<typeof vi.fn>;
  clearSessionBudget: ReturnType<typeof vi.fn>;
};

const { store } = vi.hoisted(() => ({
  store: {
    sessionTelemetry: {},
    sessionPhaseRuns: {},
    agentRunHistory: {},
    agentKindOverride: {},
    sessionBudgets: {},
    loadSessionTelemetry: vi.fn(async () => undefined),
    loadSessionBudget: vi.fn(async () => undefined),
    setSessionBudget: vi.fn(async () => undefined),
    clearSessionBudget: vi.fn(async () => undefined),
  } satisfies Store,
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (s: Store) => T) => selector(store),
}));

import { SessionCostChip } from './SessionCostChip';
import { requestSessionSpendLimitEdit } from '../../../budget/requestSessionSpendLimitEdit';

const SID = 'sess-1' as SessionId;

const record = (over: Partial<Record<keyof TelemetryRecord, unknown>> = {}): TelemetryRecord =>
  ({
    id: 'telemetry-1',
    runId: 'run-1',
    sessionId: SID,
    kind: 'turn',
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    inputTokens: 120,
    outputTokens: 220,
    estimatedCostUsd: 2.5,
    recordedAt: '2026-07-27T10:00:00.000Z',
    ...over,
  }) as TelemetryRecord;

const agent = (over: Partial<Record<keyof Agent, unknown>> = {}): Agent =>
  ({
    id: 'agent-1',
    sessionId: SID,
    ordinal: 0,
    name: 'Implementer',
    kind: 'implementer',
    status: 'completed',
    runId: 'run-1',
    ...over,
  }) as Agent;

const limit = (softCapUsd: number, onExceed: 'pause' | 'warn' = 'pause'): SessionBudget => ({
  sessionId: SID,
  softCapUsd,
  onExceed,
});

const spendChip = () => screen.getByRole('button', { name: /^Spend / });

beforeEach(() => {
  store.sessionTelemetry = {};
  store.sessionPhaseRuns = {};
  store.agentRunHistory = {};
  store.sessionBudgets = {};
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('SessionCostChip', () => {
  it('shows the spend from the start, before anything is spent', () => {
    render(<SessionCostChip sessionId={SID} />);

    expect(spendChip().textContent).toBe('$0');
    expect(spendChip().getAttribute('data-level')).toBe('free');
    expect(store.loadSessionBudget).toHaveBeenCalledWith(SID);
  });

  it('reads spend of limit with a small bar once a limit exists', () => {
    store.sessionTelemetry = { [SID]: [record({ estimatedCostUsd: 2.77 })] };
    store.sessionBudgets = { [SID]: limit(10) };
    render(<SessionCostChip sessionId={SID} />);

    expect(spendChip().textContent).toBe('$2.77 of $10.00');
    expect(spendChip().getAttribute('data-level')).toBe('clear');
    expect(document.querySelector('[data-slot="spend-bar"]')).not.toBeNull();
  });

  it('turns to a warning from 80 percent', () => {
    store.sessionTelemetry = { [SID]: [record({ estimatedCostUsd: 8.4 })] };
    store.sessionBudgets = { [SID]: limit(10) };
    render(<SessionCostChip sessionId={SID} />);

    expect(spendChip().getAttribute('data-level')).toBe('near');
  });

  it('says paused once a pausing limit is passed, and not when it only warns', () => {
    store.sessionTelemetry = { [SID]: [record({ estimatedCostUsd: 10.2 })] };
    store.sessionBudgets = { [SID]: limit(10) };
    const { unmount } = render(<SessionCostChip sessionId={SID} />);
    expect(spendChip().textContent).toBe('Paused · $10.20 of $10.00');
    unmount();

    store.sessionBudgets = { [SID]: limit(10, 'warn') };
    render(<SessionCostChip sessionId={SID} />);
    expect(spendChip().textContent).toBe('$10.20 of $10.00');
    expect(spendChip().getAttribute('data-level')).toBe('over');
  });

  it('opens a spend popover with the limit, the agents and the context cost', () => {
    store.sessionTelemetry = {
      [SID]: [
        record({ estimatedCostUsd: 2.5 }),
        record({ id: 'telemetry-2', runId: 'run-2', estimatedCostUsd: 1 }),
        record({ id: 'telemetry-3', kind: 'summarizer', runId: 'sum', estimatedCostUsd: 0.14 }),
      ],
    };
    store.sessionPhaseRuns = {
      [SID]: [
        agent(),
        agent({
          id: 'agent-2',
          name: 'Reviewer',
          kind: 'reviewer',
          runId: 'run-2',
        }),
      ],
    };
    render(<SessionCostChip sessionId={SID} />);
    fireEvent.click(spendChip());

    const dialog = screen.getByRole('dialog', { name: 'Session spend' });
    expect(dialog.textContent).toContain('$3.64');
    expect(dialog.textContent).toContain('No limit');
    expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      'ImplementerImplementerclaude-sonnet-5$2.50',
      'ReviewerReviewerclaude-sonnet-5$1.00',
    ]);
    expect(dialog.textContent).toContain('Keeping context up to date: $0.14');
    expect(store.loadSessionTelemetry).toHaveBeenCalledWith(SID);
  });

  it('sets a limit inline with what happens when it is passed', async () => {
    render(<SessionCostChip sessionId={SID} />);
    fireEvent.click(spendChip());
    fireEvent.click(screen.getByRole('button', { name: 'Set limit' }));
    fireEvent.change(screen.getByLabelText('Spend cap in dollars'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('tab', { name: /Warn only/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(store.setSessionBudget).toHaveBeenCalledWith(SID, 10, 'warn'));
  });

  it('removes a limit', async () => {
    store.sessionBudgets = { [SID]: limit(10) };
    render(<SessionCostChip sessionId={SID} />);
    fireEvent.click(spendChip());
    expect(screen.getByRole('dialog').textContent).toContain('$0 of $10.00 · Pauses workflows');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove limit' }));

    await waitFor(() => expect(store.clearSessionBudget).toHaveBeenCalledWith(SID));
  });

  it('opens straight on the editor when the paused run asks to raise the limit', async () => {
    store.sessionBudgets = { [SID]: limit(10) };
    render(<SessionCostChip sessionId={SID} />);

    requestSessionSpendLimitEdit({ sessionId: SID });

    await waitFor(() => expect(screen.getByLabelText('Spend cap in dollars')).toBeDefined());
    expect(screen.getByLabelText('Spend cap in dollars')).toHaveProperty('value', '10');
  });

  it('ignores a raise request for another session', () => {
    render(<SessionCostChip sessionId={SID} />);

    requestSessionSpendLimitEdit({ sessionId: 'sess-2' as SessionId });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the impact studio at the same session scope', () => {
    const handler = vi.fn();
    window.addEventListener('goodboy:open-impact-studio', handler);
    render(<SessionCostChip sessionId={SID} />);

    fireEvent.click(spendChip());
    fireEvent.click(screen.getByRole('button', { name: 'Open in Impact' }));

    const event = handler.mock.calls[0]?.[0] as CustomEvent<{
      scope?: { kind?: string; sessionId?: SessionId };
    }>;
    expect(event.detail.scope).toEqual({ kind: 'session', sessionId: SID });
    expect(screen.queryByRole('dialog', { name: 'Session spend' })).toBeNull();
    window.removeEventListener('goodboy:open-impact-studio', handler);
  });

  it('moves focus into the dialog and restores it after Escape', () => {
    render(<SessionCostChip sessionId={SID} />);
    const trigger = spendChip();
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole('button', { name: 'Set limit' })).toBe(document.activeElement);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Session spend' })).toBeNull();
    expect(trigger).toBe(document.activeElement);
  });
});
