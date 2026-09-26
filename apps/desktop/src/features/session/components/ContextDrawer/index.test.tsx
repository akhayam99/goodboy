// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';

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
    sessionEvents: {} as Record<string, ReadonlyArray<unknown>>,
    sessionContextSeenAt: {} as Record<string, string | null>,
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
  store.sessionEvents = {};
  store.sessionContextSeenAt = {};
  vi.clearAllMocks();
});
afterEach(cleanup);

const renderDrawer = (
  tab: 'goal' | 'decisions' | 'summary',
  view: 'current' | 'versions' = 'current',
  onClose = vi.fn(),
) => render(<ContextDrawer sessionId={SID} tab={tab} view={view} onClose={onClose} />);

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

  it('marks the decisions as seen once their tab is shown', () => {
    renderDrawer('decisions');

    expect(store.markSessionContextSeen).toHaveBeenCalledWith(SID);
  });

  it('does not mark the decisions seen from another tab', () => {
    renderDrawer('goal');

    expect(store.markSessionContextSeen).not.toHaveBeenCalled();
  });

  it('flags new decisions on their tab', () => {
    store.sessionContextSeenAt = { [SID]: '2026-09-26T10:00:00.000Z' };
    store.sessionEvents = {
      [SID]: [
        {
          kind: 'decisions_changed',
          payload: { added: 2, removed: 0 },
          createdAt: '2026-09-26T11:00:00.000Z',
        },
      ],
    };
    renderDrawer('summary');

    expect(screen.getByRole('img', { name: '2 new since you last looked' })).toBeDefined();
  });

  it('says why an empty tab is empty', () => {
    store.slots = slots('', '', '');
    const { unmount } = renderDrawer('goal');
    expect(screen.getByText('No goal yet. Every agent starts from it.')).toBeDefined();
    unmount();

    renderDrawer('summary');
    expect(screen.getByText('A summary appears after the first agent turn.')).toBeDefined();
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
