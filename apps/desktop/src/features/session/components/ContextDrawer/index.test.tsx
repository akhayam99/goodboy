// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  AgentId,
  IsoDateTime,
  SessionContextItem,
  SessionContextItemId,
  SessionDecision,
  SessionId,
} from '@goodboy/types';
import type { SummarizerPending, SummarizerRound } from '../../../../store/slices/summaries/state';

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
    settings: {} as Record<string, string>,
    sessionContextItems: {} as Record<string, ReadonlyArray<SessionContextItem>>,
    loadSessionContextItems: vi.fn(async () => undefined),
    setContextItemStatus: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
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
    requestContextUpdate: vi.fn(),
    round: null as SummarizerRound | null,
    pending: { turns: 0, isUpdateQueued: false } as SummarizerPending,
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
  useSummarizerRound: () => store.round,
  useSummarizerPending: () => store.pending,
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
  store.round = null;
  store.pending = { turns: 0, isUpdateQueued: false };
  store.historyCount = 0;
  store.sessionContextSeenAt = {};
  store.sessionDecisions = {};
  store.sessionDecisionsBaseline = {};
  store.sessionPhaseRuns = {};
  store.settings = {};
  store.sessionContextItems = {};
  vi.clearAllMocks();
});
afterEach(cleanup);

const AT = '2026-09-26T10:00:00.000Z' as IsoDateTime;

const decision = (overrides: Partial<SessionDecision>): SessionDecision => ({
  id: `d${overrides.number ?? 1}`,
  sessionId: SID,
  number: 1,
  text: 'Key redeliveries by event id',
  why: null,
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

const learning = (overrides: Partial<SessionContextItem>): SessionContextItem => ({
  id: 'l1' as SessionContextItemId,
  sessionId: SID,
  workspaceId: 'harborline' as SessionContextItem['workspaceId'],
  kind: 'learning',
  title: 'Why select! can drop a half-sent request',
  text: 'It cancels the losing branch.',
  topic: 'Rust',
  source: { role: 'reviewer', agentId: null, turnStart: 4, turnEnd: 6 },
  audience: [],
  status: 'active',
  projectName: 'notify-relay',
  isSessionDeleted: false,
  createdAt: AT,
  updatedAt: AT,
  ...overrides,
});

const ROUND: SummarizerRound = {
  finishedAt: AT,
  mode: 'turn',
  turns: 3,
  provider: 'anthropic',
  model: 'haiku-4.5',
  effort: 'low',
  inputTokens: 3184,
  outputTokens: 412,
  costUsd: 0.004,
  changed: { goal: true, decisions: 2, summary: true },
};

const contextUpdatesRow = (): HTMLElement =>
  screen.getByRole('button', { name: (name) => name.startsWith('Context updates') });

const renderDrawer = (
  tab: 'goal' | 'decisions' | 'summary' | 'learned',
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
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Goal',
      'Decisions2',
      'Summary',
      'Learned',
    ]);
    fireEvent.click(tabs[1]!);
    expect(store.openContextDrawer).toHaveBeenCalledWith({ sessionId: SID, tab: 'decisions' });
  });

  it('says which roles receive the open tab and lists them on demand', () => {
    renderDrawer('decisions');

    const toggle = screen.getByRole('button', { name: /^Visible to/ });
    expect(toggle.textContent).toBe('Visible toAll roles except Scout, Docs');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Scout').getAttribute('title')).toBe('Does not receive this');
    expect(screen.getByText('Reviewer').getAttribute('title')).toBeNull();
    expect(screen.getByText('Agents only.').tagName).toBe('P');
  });

  it('reads the Visible to line from the same map as the prompt, per tab', () => {
    renderDrawer('summary');

    expect(screen.getByRole('button', { name: /^Visible to/ }).textContent).toBe(
      'Visible toAll roles except Resolver',
    );
  });

  it('lists what this session learned, written for you only', () => {
    store.sessionContextItems = {
      [SID]: [
        learning({
          id: 'l1' as SessionContextItemId,
          title: 'Why select! can drop a half-sent request',
        }),
        learning({ id: 'l2' as SessionContextItemId, title: 'An old one', status: 'dismissed' }),
      ],
    };
    renderDrawer('learned');

    expect(screen.getByRole('tab', { name: /Learned/ }).textContent).toBe('Learned1');
    expect(screen.getByRole('button', { name: /^Visible to/ }).textContent).toBe(
      'Visible toYou only',
    );
    const row = screen.getByRole('button', { name: /Why select! can drop/ });
    expect(row.textContent).toContain('Turns 4 to 6 · Reviewer');
    expect(screen.queryByText('An old one')).toBeNull();
    fireEvent.click(row);
    expect(screen.getByText('It cancels the losing branch.').tagName).toBe('P');
    expect(screen.getByRole('button', { name: 'Dismiss' }).tagName).toBe('BUTTON');
  });

  it('says nothing was learned yet on an empty Learned tab', () => {
    renderDrawer('learned');

    expect(screen.getByText('Nothing learned in this session yet.').tagName).toBe('P');
  });

  it('hides Visible to when the role map is switched off', () => {
    store.settings = { 'context.roleMap': 'false' };
    renderDrawer('decisions');

    expect(screen.queryByRole('button', { name: /^Visible to/ })).toBeNull();
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

  it('explains a decision with its why and shows nothing when there is none', () => {
    const longWhy = [
      'Northwind retries every webhook on a 5xx and Acme replays the whole day on a restart.',
      'Keying on the event id is the only guard that holds for both providers at once.',
    ].join(' ');
    store.sessionDecisions = {
      [SID]: [
        decision({ number: 1, text: 'Fix only payments-api' }),
        decision({ number: 2, text: 'Return 200 on a duplicate delivery', why: longWhy }),
      ],
    };
    const { container } = renderDrawer('decisions');

    const whys = [...container.querySelectorAll('[data-decision-why]')];
    expect(whys.map((node) => node.getAttribute('data-decision-why'))).toEqual(['2']);
    expect(whys[0]?.querySelector('[data-clamped="true"]')).not.toBeNull();
    fireEvent.click(within(whys[0] as HTMLElement).getByRole('button', { name: 'Show more' }));
    expect(whys[0]?.querySelector('[data-clamped="false"]')).not.toBeNull();
    expect(within(whys[0] as HTMLElement).getByRole('button', { name: 'Show less' })).toBeDefined();
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

  it('opens a decision on click, revealing Edit and Remove, and adds decisions as yours', () => {
    store.sessionDecisions = { [SID]: [decision({ number: 1 })] };
    const { container } = renderDrawer('decisions');
    const actor = { author: 'user', agentId: null, turnOrdinal: null };

    expect(screen.queryByRole('button', { name: 'Edit decision 1' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove decision 1' })).toBeNull();

    fireEvent.click(container.querySelector('[data-decision="1"] button')!);
    expect(screen.getByRole('button', { name: 'Edit decision 1' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove decision 1' })).toBeDefined();

    fireEvent.click(container.querySelector('[data-decision="1"] button')!);
    expect(screen.queryByRole('button', { name: 'Edit decision 1' })).toBeNull();

    const field = screen.getByRole('textbox', { name: 'Add a decision' });
    fireEvent.change(field, { target: { value: 'Keep processed ids for 30 days' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(store.applySessionDecisionOps).toHaveBeenLastCalledWith({
      sessionId: SID,
      ops: [{ kind: 'add', text: 'Keep processed ids for 30 days' }],
      actor,
    });
  });

  it('removes a decision, keeps it in place with undo, and counts it on the visit banner', () => {
    store.sessionDecisions = { [SID]: [decision({ number: 1 })] };
    const { container } = renderDrawer('decisions');
    const actor = { author: 'user', agentId: null, turnOrdinal: null };

    fireEvent.click(container.querySelector('[data-decision="1"] button')!);
    fireEvent.click(screen.getByRole('button', { name: 'Remove decision 1' }));

    expect(store.applySessionDecisionOps).toHaveBeenLastCalledWith({
      sessionId: SID,
      ops: [{ kind: 'withdraw', number: 1, reason: null }],
      actor,
    });
    expect(screen.getByText('Key redeliveries by event id')).toBeDefined();
    expect(screen.getByText('Removed')).toBeDefined();
    expect(screen.getByText('1 change on this visit')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Undo all' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Undo remove of decision 1' }));
    expect(store.applySessionDecisionOps).toHaveBeenLastCalledWith({
      sessionId: SID,
      ops: [{ kind: 'restore', number: 1 }],
      actor,
    });
    expect(screen.queryByText('1 change on this visit')).toBeNull();
    expect(screen.queryByText('Removed')).toBeNull();
  });

  it('undoes every removal on this visit at once', () => {
    store.sessionDecisions = {
      [SID]: [
        decision({ number: 1 }),
        decision({ number: 2, text: 'Return 200 on a duplicate delivery' }),
      ],
    };
    const { container } = renderDrawer('decisions');
    const actor = { author: 'user', agentId: null, turnOrdinal: null };

    fireEvent.click(container.querySelector('[data-decision="1"] button')!);
    fireEvent.click(screen.getByRole('button', { name: 'Remove decision 1' }));
    fireEvent.click(container.querySelector('[data-decision="2"] button')!);
    fireEvent.click(screen.getByRole('button', { name: 'Remove decision 2' }));
    expect(screen.getByText('2 changes on this visit')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Undo all' }));
    expect(store.applySessionDecisionOps).toHaveBeenLastCalledWith({
      sessionId: SID,
      ops: [
        { kind: 'restore', number: 1 },
        { kind: 'restore', number: 2 },
      ],
      actor,
    });
    expect(screen.queryByText(/changes on this visit/)).toBeNull();
  });

  it('drops a removed decision into Removed by you after leaving and re-entering', () => {
    store.sessionDecisions = { [SID]: [decision({ number: 1 })] };
    const { container, unmount } = renderDrawer('decisions');

    fireEvent.click(container.querySelector('[data-decision="1"] button')!);
    fireEvent.click(screen.getByRole('button', { name: 'Remove decision 1' }));
    expect(screen.getByText('Removed')).toBeDefined();
    unmount();

    store.sessionDecisions = {
      [SID]: [decision({ number: 1, status: 'withdrawn', closedBy: 'user', reason: null })],
    };
    renderDrawer('decisions');

    expect(screen.queryByText('Key redeliveries by event id')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Replaced and removed/ }));
    expect(screen.getByText('Key redeliveries by event id')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Restore' })).toBeDefined();
  });

  it('offers Restore only on decisions you removed, not on ones an agent closed', () => {
    store.sessionDecisions = {
      [SID]: [
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

    fireEvent.click(screen.getByRole('button', { name: /Replaced and removed/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Replaced/ }));
    expect(screen.getByText('"The ledger already keeps retry state"')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Restore' })).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: /Replaced and removed/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Replaced/ }));
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
    const { container } = renderDrawer('decisions');

    fireEvent.click(container.querySelector('[data-decision="1"] button')!);
    expect(screen.getByText('Key redeliveries by event id')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Edit decision 1' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove decision 1' })).toBeNull();
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
    store.summarizer = { status: 'running', lastUpdate: AT, lastAttempt: null };
    const { unmount } = renderDrawer('decisions');
    expect(contextUpdatesRow().textContent).toContain('Updating…');
    unmount();

    store.summarizer = { status: 'error', lastUpdate: AT, lastAttempt: { turnInput: 'x' } };
    renderDrawer('decisions');
    expect(contextUpdatesRow().textContent).toContain("Couldn't update");
    fireEvent.click(contextUpdatesRow());
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(store.retrySummarizer).toHaveBeenCalledWith(SID);
    expect(store.requestContextUpdate).not.toHaveBeenCalled();
  });

  it('opens Context updates on the last round: model, usage and what changed', () => {
    store.summarizer = { status: 'idle', lastUpdate: AT, lastAttempt: null };
    store.round = ROUND;
    store.pending = { turns: 2, isUpdateQueued: false };
    renderDrawer('summary');

    fireEvent.click(contextUpdatesRow());

    const panel = screen.getByRole('definition', { name: 'Last update' });
    expect(panel.textContent).toContain('after 3 turns');
    expect(screen.getByRole('definition', { name: 'Model' }).textContent).toContain(
      'Haiku 4.5 · low effort',
    );
    expect(screen.getByRole('definition', { name: 'Used' }).textContent).toBe(
      '3,184 in · 412 out · about <$0.01',
    );
    expect(screen.getByText(/2 new turns since the last update\./).tagName).toBe('SPAN');
    fireEvent.click(screen.getByRole('button', { name: '2 decisions' }));
    expect(store.openContextDrawer).toHaveBeenCalledWith({ sessionId: SID, tab: 'decisions' });
    expect(screen.getByRole('button', { name: 'Goal' }).textContent).toBe('Goal');
    expect(screen.getByRole('definition', { name: 'Changed' }).textContent).toBe(
      'Goal, 2 decisions, Summary',
    );
  });

  it('queues Update now in the session queue and shows it as queued', () => {
    store.summarizer = { status: 'idle', lastUpdate: AT, lastAttempt: null };
    store.round = ROUND;
    const { rerender } = renderDrawer('decisions');
    fireEvent.click(contextUpdatesRow());

    fireEvent.click(screen.getByRole('button', { name: 'Update now' }));
    expect(store.requestContextUpdate).toHaveBeenCalledWith(SID);

    store.pending = { turns: 0, isUpdateQueued: true };
    rerender(<ContextDrawer sessionId={SID} tab="decisions" view="current" onClose={vi.fn()} />);
    const queued = screen.getByRole('button', { name: 'Queued' });
    expect(queued.hasAttribute('disabled')).toBe(true);
    expect(contextUpdatesRow().textContent).toContain('Queued');
  });

  it('sends Change model to the step summaries row in Defaults', () => {
    store.summarizer = { status: 'idle', lastUpdate: AT, lastAttempt: null };
    const opened = vi.fn();
    window.addEventListener('goodboy:open-settings', opened);
    renderDrawer('decisions');
    fireEvent.click(contextUpdatesRow());

    fireEvent.click(screen.getByRole('button', { name: 'Change model' }));

    window.removeEventListener('goodboy:open-settings', opened);
    const event = opened.mock.calls[0]?.[0];
    expect(event instanceof CustomEvent ? event.detail : null).toEqual({
      scope: 'providers',
      section: 'summarizer',
    });
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

    expect(screen.getByRole('button', { name: /Copy context/i })).toBeDefined();
  });
});
