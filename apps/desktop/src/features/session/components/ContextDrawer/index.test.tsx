// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { AgentId, IsoDateTime, SessionDecision, SessionId } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    slots: [] as ReadonlyArray<{ key: string; value: string; enabled: boolean }>,
    summarizer: { status: 'idle', lastUpdate: null, lastAttempt: null } as {
      status: 'idle' | 'running' | 'error';
      lastUpdate: string | null;
      lastAttempt: unknown;
    },
    historyCount: 0,
    history: [] as ReadonlyArray<unknown>,
    sessionContextSeenAt: {} as Record<string, string | null>,
    sessionDecisions: {} as Record<string, ReadonlyArray<SessionDecision>>,
    sessionDecisionsBaseline: {} as Record<string, string | null>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<{ id: string; name: string }>>,
    loadSessionDecisions: vi.fn(async () => undefined),
    applySessionDecisionOps: vi.fn(async () => undefined),
    openContextDrawer: vi.fn(),
    ensureSessionSlots: vi.fn(async () => undefined),
    loadSessionSlots: vi.fn(async () => undefined),
    loadSessionOpenQuestions: vi.fn(async () => undefined),
    loadSessionContextSeen: vi.fn(async () => undefined),
    markSessionContextSeen: vi.fn(async () => undefined),
    upsertSessionSlot: vi.fn(async () => undefined),
    loadSlotHistory: vi.fn(async () => undefined),
    retrySummarizer: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
  useSessionSlots: () => store.slots,
  useSessionLoading: () => ({ slots: false }),
  useSessionSlotsLoad: () => 'loaded',
  useSessionOpenQuestions: () => [{ status: 'open', text: 'Backfill the old credits?' }],
  useSlotHistoryCount: () => store.historyCount,
  useSlotHistory: () => store.history,
  useSummarizerStatus: () => store.summarizer,
}));

vi.mock('../../../context/components/ContextPanel/strips/GoalAttachmentsStrip', () => ({
  GoalAttachmentsStrip: () => null,
}));

import { ContextDrawer } from './index';

const SID = 'sess-1' as SessionId;

const slots = (goal: string, decisions: string, summary: string) => [
  { key: 'goal', value: goal, enabled: true },
  { key: 'decisions', value: decisions, enabled: true },
  { key: 'last_output_summary', value: summary, enabled: true },
];

beforeEach(() => {
  store.slots = slots(
    'Stop crediting an invoice twice.',
    '- Key redeliveries by event id\n- Keep the webhook endpoint',
    '#### Problem\nwhy\n\n#### State\n- fix merged\n\n#### Next\n- backfill',
  );
  store.summarizer = { status: 'idle', lastUpdate: null, lastAttempt: null };
  store.historyCount = 0;
  store.sessionContextSeenAt = {};
  store.sessionDecisions = {};
  store.sessionDecisionsBaseline = {};
  store.sessionPhaseRuns = {};
  vi.clearAllMocks();
});
afterEach(cleanup);

const AT = '2026-09-26T10:00:00.000Z' as IsoDateTime;

const decision = (overrides: Partial<SessionDecision>): SessionDecision => ({
  id: `d${overrides.number ?? 1}`,
  sessionId: SID,
  number: 1,
  text: 'Key redeliveries by event id',
  status: 'active',
  replacedBy: null,
  author: 'agent',
  agentId: 'implementer' as AgentId,
  turnOrdinal: 9,
  reason: null,
  closedBy: null,
  closedByAgentId: null,
  previousText: null,
  rewordedAt: null,
  createdAt: AT,
  updatedAt: AT,
  ...overrides,
});

const renderDrawer = (
  tab: 'goal' | 'decisions' | 'summary',
  view: 'current' | 'versions' = 'current',
  onClose = vi.fn(),
  highlight: ReadonlyArray<number> = [],
) =>
  render(
    <ContextDrawer sessionId={SID} tab={tab} view={view} highlight={highlight} onClose={onClose} />,
  );

describe('ContextDrawer', () => {
  it('orders its tabs Goal, Decisions, Summary and moves with the tab strip', () => {
    renderDrawer('summary');

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Goal', 'Decisions2', 'Summary']);
    fireEvent.click(tabs[1]!);
    expect(store.openContextDrawer).toHaveBeenCalledWith({ sessionId: SID, tab: 'decisions' });
  });

  it('shows the summary as State, Next and Learned, without Problem', () => {
    renderDrawer('summary');

    expect(screen.queryByText('Problem')).toBeNull();
    const panel = screen.getByRole('region', { name: 'Context' });
    expect(within(panel).getByText('State')).toBeDefined();
    expect(within(panel).getByText('Next')).toBeDefined();
  });

  it('marks the context seen when it opens on any tab and again when it closes', () => {
    const { unmount } = renderDrawer('goal');

    expect(store.markSessionContextSeen).toHaveBeenCalledTimes(1);
    unmount();
    expect(store.markSessionContextSeen).toHaveBeenCalledTimes(2);
  });

  it('dots the Decisions tab when they changed since the last look', () => {
    store.sessionDecisionsBaseline = { [SID]: '2026-09-26T09:00:00.000Z' };
    store.sessionDecisions = { [SID]: [decision({ number: 1 })] };
    renderDrawer('summary');

    expect(screen.getByRole('img', { name: 'Changed since you last looked' })).toBeDefined();
  });

  it('numbers the decisions newest first and says who settled them', () => {
    store.sessionPhaseRuns = { [SID]: [{ id: 'implementer', name: 'Implementer' }] };
    store.sessionDecisions = {
      [SID]: [
        decision({ number: 1, text: 'Fix only payments-api', author: 'user', agentId: null }),
        decision({ number: 2, text: 'Return 200 on a duplicate delivery' }),
      ],
    };
    const { container } = renderDrawer('decisions');

    const numbers = [...container.querySelectorAll('[data-decision]')].map((node) =>
      node.getAttribute('data-decision'),
    );
    expect(numbers).toEqual(['2', '1']);
    expect(screen.getByText(/^Implementer · turn 9/)).toBeDefined();
    expect(screen.getByText(/^You · /)).toBeDefined();
  });

  it('tags what arrived since the last look and says when Goodboy reworded one', () => {
    store.sessionDecisionsBaseline = { [SID]: '2026-09-26T09:00:00.000Z' };
    store.sessionDecisions = {
      [SID]: [
        decision({
          number: 1,
          text: 'Key idempotency on the provider event id',
          previousText: 'Use event.id as idempotency key',
          rewordedAt: AT,
          createdAt: '2026-09-26T08:00:00.000Z' as IsoDateTime,
        }),
        decision({ number: 2, text: 'Show the banner after the third failed retry' }),
      ],
    };
    renderDrawer('decisions');

    expect(screen.getAllByText('New')).toHaveLength(1);
    expect(screen.getByText(/^Reworded by Goodboy/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Show previous' }));
    expect(screen.getByText('Use event.id as idempotency key')).toBeDefined();
  });

  it('withdraws, restores and adds decisions as yours', () => {
    store.sessionDecisions = {
      [SID]: [
        decision({ number: 1 }),
        decision({
          number: 2,
          text: 'Add a retry counter column to invoices',
          status: 'withdrawn',
          reason: 'The ledger already keeps retry state',
          closedBy: 'agent',
          closedByAgentId: 'implementer' as AgentId,
        }),
      ],
    };
    renderDrawer('decisions');
    const actor = { author: 'user', agentId: null, turnOrdinal: null };

    fireEvent.click(screen.getByRole('button', { name: 'Withdraw decision 1' }));
    expect(store.applySessionDecisionOps).toHaveBeenLastCalledWith({
      sessionId: SID,
      ops: [{ kind: 'withdraw', number: 1, reason: null }],
      actor,
    });

    fireEvent.click(screen.getByRole('button', { name: /Replaced and withdrawn/ }));
    expect(screen.getByText('"The ledger already keeps retry state"')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(store.applySessionDecisionOps).toHaveBeenLastCalledWith({
      sessionId: SID,
      ops: [{ kind: 'restore', number: 2 }],
      actor,
    });

    const field = screen.getByRole('textbox', { name: 'Add a decision' });
    fireEvent.change(field, { target: { value: 'Keep processed ids for 30 days' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(store.applySessionDecisionOps).toHaveBeenLastCalledWith({
      sessionId: SID,
      ops: [{ kind: 'add', text: 'Keep processed ids for 30 days' }],
      actor,
    });
  });

  it('points a replaced decision at the one that replaced it', () => {
    store.sessionDecisions = {
      [SID]: [
        decision({
          number: 5,
          text: 'Show the banner after the first failed retry',
          author: 'user',
          agentId: null,
          status: 'replaced',
          replacedBy: 9,
          reason: 'One failed retry is provider noise',
          closedBy: 'agent',
          closedByAgentId: 'implementer' as AgentId,
        }),
        decision({ number: 9, text: 'Show the banner after the third failed retry' }),
      ],
    };
    store.sessionPhaseRuns = { [SID]: [{ id: 'implementer', name: 'Implementer' }] };
    renderDrawer('decisions');

    expect(screen.getByText(/replaces 5/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Replaced and withdrawn/ }));
    expect(screen.getByText(/^You · replaced by/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Go to decision 9' })).toBeDefined();
  });

  it('highlights the rows Activity opened it on, opening the closed group when needed', () => {
    store.sessionDecisions = {
      [SID]: [
        decision({ number: 1 }),
        decision({ number: 2, text: 'Old retry rule', status: 'withdrawn', reason: 'stale' }),
        decision({ number: 3, text: 'Third retry' }),
      ],
    };
    const { container } = renderDrawer('decisions', 'current', vi.fn(), [2, 3]);

    const highlighted = [...container.querySelectorAll('[data-decision].bg-selected')].map((node) =>
      node.getAttribute('data-decision'),
    );
    expect(highlighted.sort()).toEqual(['2', '3']);
    expect(screen.getByText('Old retry rule')).toBeDefined();
  });

  it('fades in a reworded text and reveals a decision that arrives while open', async () => {
    store.sessionDecisions = { [SID]: [decision({ number: 1, text: 'Key on the event id' })] };
    const { container, rerender } = renderDrawer('decisions');
    expect(container.querySelector('[data-swapped]')).toBeNull();

    store.sessionDecisions = {
      [SID]: [
        decision({ number: 1, text: 'Key idempotency on the event id' }),
        decision({ number: 2, text: 'Keep processed ids for 30 days' }),
      ],
    };
    rerender(<ContextDrawer sessionId={SID} tab="decisions" view="current" onClose={vi.fn()} />);

    expect(container.querySelector('[data-swapped="true"]')?.className).toContain(
      'motion-safe:animate-text-swap',
    );
    expect(await screen.findByText('Keep processed ids for 30 days')).toBeDefined();
  });

  it('keeps the decisions readable but not editable while the context updates', () => {
    store.summarizer = { status: 'running', lastUpdate: null, lastAttempt: null };
    store.sessionDecisions = { [SID]: [decision({ number: 1 })] };
    renderDrawer('decisions');

    expect(screen.getByText('Key redeliveries by event id')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Withdraw decision 1' })).toBeNull();
    expect(screen.getByText('Editing opens when the update finishes.')).toBeDefined();
  });

  it('says why an empty tab is empty', () => {
    store.slots = slots('', '', '');
    const { unmount } = renderDrawer('goal');
    expect(screen.getByText('No goal yet. Every agent starts from it.')).toBeDefined();
    unmount();

    const summary = renderDrawer('summary');
    expect(screen.getByText('A summary appears after the first agent turn.')).toBeDefined();
    summary.unmount();

    store.sessionDecisions = { [SID]: [] };
    renderDrawer('decisions');
    expect(
      screen.getByText(
        'No decisions yet. Agents record one when they settle a choice; you can add your own.',
      ),
    ).toBeDefined();
  });

  it('says it is updating while the summarizer writes, and offers a retry when it failed', () => {
    store.summarizer = { status: 'running', lastUpdate: null, lastAttempt: null };
    const { unmount } = renderDrawer('decisions');
    expect(screen.getByText('Updating…')).toBeDefined();
    unmount();

    store.summarizer = { status: 'error', lastUpdate: null, lastAttempt: { turnInput: '' } };
    renderDrawer('decisions');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(store.retrySummarizer).toHaveBeenCalledWith(SID);
  });

  it('keeps the goal editable in place, and locked while the context updates', () => {
    renderDrawer('goal');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Goal' }), {
      target: { value: 'Stop double credits.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(store.upsertSessionSlot).toHaveBeenCalledWith(SID, 'goal', 'Stop double credits.');
  });

  it('opens Versions inside the drawer, and Escape leaves the view before the drawer', () => {
    store.historyCount = 3;
    const onClose = vi.fn();
    renderDrawer('summary', 'versions', onClose);

    expect(screen.getByRole('button', { name: 'Summary' })).toBeDefined();
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
    expect(store.openContextDrawer).toHaveBeenCalledWith({
      sessionId: SID,
      tab: 'summary',
      view: 'current',
    });
  });

  it('copies the brief in the same order as the tabs', () => {
    renderDrawer('goal');

    expect(screen.getByRole('button', { name: /Copy as brief/i })).toBeDefined();
  });
});
