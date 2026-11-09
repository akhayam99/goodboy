// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId, type IsoDateTime, type SessionDecision } from '@goodboy/types';
import type { SummarizerRound } from '../../../../store/slices/summaries/state';
import type {
  ContextDrawerSection,
  ContextDrawerView,
} from '../../../../store/slices/drawer/state';
import { aDecision } from '../../../../test/aDecision';
import { importStore, resetStoryStore, type StoryStore } from '../../../../store/storyHarness';
import {
  SESSION_ID,
  seedActivityRunScene,
} from '../../../../app/components/MockScene/scenes/activityRunSeed';
import { ContextDrawer } from '.';
import { summarizerQueues } from '../../../../store/slices/turn/turnHelpers';
import { contextUpdateHint } from './contextUpdateCopy';

type SaveParams = Parameters<(typeof import('@goodboy/db'))['saveSessionDecisions']>[0];

const h = vi.hoisted(() => {
  const ledger: ReadonlyArray<SessionDecision> = [];
  return {
    ledger,
    persistRead: vi.fn(async () => undefined),
    saveSlot: vi.fn(async () => undefined),
    saveDecisions: vi.fn(async (_params: SaveParams) => undefined),
  };
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    setSessionContextSeenAt: h.persistRead,
    upsertContextSlot: h.saveSlot,
    listSessionDecisions: async () => h.ledger,
    saveSessionDecisions: h.saveDecisions,
  }),
);

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
});

beforeEach(async () => {
  await resetStoryStore();
  seedActivityRunScene();
  h.saveSlot.mockReset();
  h.saveSlot.mockResolvedValue(undefined);
  h.persistRead.mockReset();
  h.persistRead.mockResolvedValue(undefined);
  h.ledger = store.getState().sessionDecisions[SESSION_ID] ?? [];
  h.saveDecisions.mockReset();
  h.saveDecisions.mockImplementation(async ({ decisions }: SaveParams) => {
    h.ledger = h.ledger.map((row) => decisions.find((next) => next.number === row.number) ?? row);
  });
  store.setState({
    slotHistoryCounts: { [SESSION_ID]: { goal: 2, decisions: 2, last_output_summary: 2 } },
  });
});

afterEach(() => {
  cleanup();
  summarizerQueues.delete(SESSION_ID);
});

type MountParams = {
  readonly section?: ContextDrawerSection;
  readonly view?: ContextDrawerView;
  readonly highlight?: ReadonlyArray<number>;
  readonly onClose?: () => void;
};

const mount = ({
  section = 'goal',
  view = 'current',
  highlight,
  onClose = () => undefined,
}: MountParams = {}) =>
  render(
    <ContextDrawer
      sessionId={SESSION_ID}
      section={section}
      view={view}
      {...(highlight !== undefined && { highlight })}
      onClose={onClose}
    />,
  );

type SlotValues = {
  readonly goal: string;
  readonly decisions: string;
  readonly summary: string;
};

const setSlots = ({ goal, decisions, summary }: SlotValues) =>
  store.setState({
    sessionSlots: {
      [SESSION_ID]: [
        { key: 'goal', value: goal, enabled: true },
        { key: 'decisions', value: decisions, enabled: true },
        { key: 'last_output_summary', value: summary, enabled: true },
      ],
    },
  });

type LedgerParams = {
  readonly ledger: ReadonlyArray<SessionDecision>;
};

const setLedger = ({ ledger }: LedgerParams) => {
  h.ledger = ledger;
  store.setState({ sessionDecisions: { [SESSION_ID]: ledger } });
};

const AT = brandId<IsoDateTime>({ value: '2026-11-01T10:00:00.000Z' });

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

type StatusParams = {
  readonly status: 'idle' | 'running' | 'error';
};

const setSummarizer = ({ status }: StatusParams) =>
  store.setState({
    summarizerStatus: {
      [SESSION_ID]: {
        status,
        lastUpdate: AT,
        error: null,
        lastUsage: null,
        lastAttempt: null,
      },
    },
  });

const contextUpdatesRow = (): HTMLElement =>
  screen.getByRole('button', { name: (name) => name.startsWith('Context updates') });

describe('Context drawer', () => {
  it('draws each changed decision once, before unchanged decisions, with one mark on its row', () => {
    const { container } = mount();
    expect(screen.queryByText('Changed since you last looked')).toBeNull();
    expect(screen.queryByText('New')).toBeNull();
    for (const change of ['Added', 'Replaced by 7', 'Withdrawn', 'Reworded']) {
      screen.getByText(change, { exact: true });
    }
    const numbers = [...container.querySelectorAll('[data-decision]')].map((row) =>
      row.getAttribute('data-decision'),
    );
    expect(numbers.length).toBe(new Set(numbers).size);
    expect(numbers.slice(0, 4)).toEqual(['7', '5', '8', '1']);
    expect(container.querySelector('[data-decision="5"] .line-through')).not.toBeNull();
    screen.getByRole('region', { name: 'State' });
    screen.getByRole('region', { name: 'Next' });
    screen.getByRole('region', { name: 'Learned' });
  });

  it('keeps the marks while saving, then clears them without closing the drawer', async () => {
    let finish: () => void = () => undefined;
    h.persistRead.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          finish = () => resolve(undefined);
        }),
    );
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    screen.getByText('Added');
    screen.getByText('Withdrawn');
    await act(async () => {
      finish();
    });
    expect(screen.queryByText('Added')).toBeNull();
    expect(screen.queryByText('Withdrawn')).toBeNull();
    screen.getByRole('region', { name: 'Context' });
    expect(document.querySelector('[data-decision="5"]')).toBeNull();
  });

  it('keeps marks on failure and retries the same read', async () => {
    h.persistRead.mockRejectedValueOnce(new Error('disk full'));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Mark as read' }).hasAttribute('disabled')).toBe(
        false,
      ),
    );
    screen.getByText('Added');
    expect(store.getState().sessionDecisionsBaseline[SESSION_ID]).toBe(
      store.getState().sessionContextSeenAt[SESSION_ID],
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    await waitFor(() => expect(screen.queryByText('Added')).toBeNull());
  });

  it('shows a new mark when a later decision arrives after reading', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    await waitFor(() => expect(screen.queryByText('Added')).toBeNull());
    const template = h.ledger[0];
    if (template === undefined) {
      throw new Error('Missing decision seed');
    }
    const later = brandId<IsoDateTime>({ value: '2099-01-01T00:00:00.000Z' });
    act(() => {
      store.setState({
        sessionDecisions: {
          [SESSION_ID]: [
            ...h.ledger,
            {
              ...template,
              id: 'decision-northwind',
              number: 99,
              author: 'agent',
              status: 'active',
              createdAt: later,
              updatedAt: later,
            },
          ],
        },
      });
    });
    await screen.findByText('Added');
  });

  it.each(['Goal', 'Decisions', 'Summary'])(
    'puts Edit, Versions and Who reads this in one %s menu, reachable with arrows',
    (label) => {
      mount();
      fireEvent.click(screen.getByRole('button', { name: `${label} actions` }));
      const menu = screen.getByRole('menu', { name: `${label} actions` });
      const items = within(menu).getAllByRole('menuitem');
      expect(items.map((item) => item.textContent)).toEqual(['Edit', 'Versions', 'Who reads this']);
      fireEvent.keyDown(items[0] ?? menu, { key: 'Home' });
      expect(document.activeElement).toBe(items[0]);
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(items[1]);
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(items[2]);
      fireEvent.click(items[2] ?? menu);
      screen.getByText('Reviewer');
    },
  );

  it('opens editing and versions from the card menu', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Summary actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    screen.getByRole('textbox', { name: 'Session summary source' });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Session summary source' }), {
      key: 'Escape',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Summary actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Versions' }));
    expect(store.getState().drawer).toMatchObject({
      kind: 'context',
      payload: { section: 'summary', view: 'versions' },
    });
  });

  it('keeps a goal draft after failure and saves it on retry', async () => {
    h.saveSlot.mockRejectedValueOnce(new Error('disk full'));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const field = screen.getByRole('textbox', { name: 'Goal' });
    fireEvent.change(field, { target: { value: 'Keep Harborline retries idempotent.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(h.saveSlot).toHaveBeenCalledOnce());
    expect(field.getAttribute('disabled')).toBeNull();
    screen.getByRole('textbox', { name: 'Goal' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Goal' })).toBeNull());
    screen.getByText('Keep Harborline retries idempotent.');
  });

  it('keeps a summary source draft after failure and saves it on retry', async () => {
    h.saveSlot.mockRejectedValueOnce(new Error('disk full'));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Summary actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const field = screen.getByRole('textbox', { name: 'Session summary source' });
    fireEvent.change(field, { target: { value: '## Next\nKeep Harborline retries idempotent.' } });
    fireEvent.blur(field);
    await waitFor(() => expect(h.saveSlot).toHaveBeenCalledOnce());
    screen.getByRole('textbox', { name: 'Session summary source' });
    fireEvent.blur(field);
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Session summary source' })).toBeNull(),
    );
    screen.getByText('Keep Harborline retries idempotent.');
  });

  it('retries a failed context update through the session queue', () => {
    const status = store.getState().summarizerStatus[SESSION_ID];
    if (status === undefined) {
      throw new Error('Missing update status');
    }
    store.setState({
      summarizerStatus: {
        [SESSION_ID]: {
          ...status,
          status: 'error',
          error: 'Context update failed',
          lastAttempt: { turnInput: '', turnOutput: '', workingDir: null },
        },
      },
    });
    summarizerQueues.set(SESSION_ID, { inFlight: true, scheduled: null, queued: [] });
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Context updates:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(store.getState().summarizerPending[SESSION_ID]?.isUpdateQueued).toBe(true);
    expect(summarizerQueues.get(SESSION_ID)?.queued).toMatchObject([
      { mode: 'consolidate', isRequested: true },
    ]);
    expect(contextUpdateHint({ phase: 'running', pendingTurns: 0, hasContext: true })).toBe('');
    expect(contextUpdateHint({ phase: 'failed', pendingTurns: 0, hasContext: true })).toBe('');
    expect(contextUpdateHint({ phase: 'idle', pendingTurns: 2, hasContext: true })).toBe(
      '2 new replies since the last update.',
    );
  });

  it.each(['Undo remove of decision 7', 'Undo all'])(
    'keeps %s after a failed restore and retries it',
    async (label) => {
      mount();
      const row = document.querySelector<HTMLElement>('[data-decision="7"]');
      if (row === null) {
        throw new Error('Missing decision');
      }
      fireEvent.click(within(row).getAllByRole('button')[0] ?? row);
      fireEvent.click(screen.getByRole('button', { name: 'Remove decision 7' }));
      const undo = await screen.findByRole('button', { name: label });
      h.saveDecisions.mockRejectedValueOnce(new Error('disk full'));
      fireEvent.click(undo);
      await waitFor(() => expect(h.saveDecisions).toHaveBeenCalledTimes(2));
      screen.getByRole('button', { name: label });
      fireEvent.click(screen.getByRole('button', { name: label }));
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Undo all' })).toBeNull());
    },
  );

  it('restores a decision removed on a previous visit', async () => {
    h.ledger = h.ledger.map((row) =>
      row.number === 7 ? { ...row, status: 'withdrawn', closedBy: 'user' } : row,
    );
    store.setState({ sessionDecisions: { [SESSION_ID]: h.ledger } });
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Replaced and removed/ }));
    const removed = document.querySelector<HTMLElement>('[data-decision="7"]');
    if (removed === null) {
      throw new Error('Missing decision 7');
    }
    fireEvent.click(within(removed).getByRole('button', { name: 'Restore' }));
    await waitFor(() =>
      expect(
        store.getState().sessionDecisions[SESSION_ID]?.find((row) => row.number === 7)?.status,
      ).toBe('active'),
    );
  });

  it('removes after persistence and restores through each Undo path', async () => {
    mount();
    const row = document.querySelector<HTMLElement>('[data-decision="7"]');
    if (row === null) {
      throw new Error('Missing decision 7');
    }
    fireEvent.click(within(row).getAllByRole('button')[0] ?? row);
    fireEvent.click(screen.getByRole('button', { name: 'Remove decision 7' }));
    await screen.findByRole('button', { name: 'Undo remove of decision 7' });
    fireEvent.click(screen.getByRole('button', { name: 'Undo remove of decision 7' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Undo all' })).toBeNull());
    expect(
      store.getState().sessionDecisions[SESSION_ID]?.find((decision) => decision.number === 7)
        ?.status,
    ).toBe('active');
    const restoredRow = document.querySelector<HTMLElement>('[data-decision="7"]');
    if (restoredRow === null) {
      throw new Error('Missing restored decision');
    }
    fireEvent.click(within(restoredRow).getAllByRole('button')[0] ?? restoredRow);
    fireEvent.click(screen.getByRole('button', { name: 'Remove decision 7' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo all' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Undo all' })).toBeNull());
    expect(
      store.getState().sessionDecisions[SESSION_ID]?.find((decision) => decision.number === 7)
        ?.status,
    ).toBe('active');
  });
});

describe('Context drawer sections', () => {
  it('reads as one scroll of cards with no tabs: Goal, Decisions, Summary and Explanations', () => {
    mount();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Context', 'Goal', 'Decisions', 'Summary', 'Explanations']);
    expect(
      Array.from(document.querySelectorAll('[data-context-card]')).map((card) =>
        card.getAttribute('data-context-section'),
      ),
    ).toEqual(['goal', 'decisions', 'summary', 'explanations']);
  });

  it('copies the brief from the header', () => {
    mount();
    screen.getByRole('button', { name: /Copy context/i });
  });

  it('counts the active decisions on the card header from two, never one', () => {
    const countOf = () =>
      screen.getByRole('region', { name: 'Decision records' }).querySelector('[data-context-count]')
        ?.textContent ?? null;
    setLedger({ ledger: [aDecision({ sessionId: SESSION_ID, number: 1 })] });
    const { unmount } = mount();
    expect(countOf()).toBeNull();
    unmount();

    setLedger({
      ledger: [
        aDecision({ sessionId: SESSION_ID, number: 1 }),
        aDecision({ sessionId: SESSION_ID, number: 2 }),
      ],
    });
    mount();
    expect(countOf()).toBe('2');
  });

  it('shows the marks and Mark as read on a drawer restored without its own baseline', () => {
    store.setState({ sessionDecisionsBaseline: {} });
    mount({ section: 'decisions' });
    screen.getByText('Added');
    screen.getByRole('button', { name: 'Mark as read' });
  });

  it('shows no marks for a session whose first look is now', () => {
    const now = brandId<IsoDateTime>({ value: new Date().toISOString() });
    store.setState({
      sessionDecisionsBaseline: {},
      sessionContextSeenAt: { [SESSION_ID]: now },
    });
    mount({ section: 'decisions' });
    expect(screen.queryByText('Added')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark as read' })).toBeNull();
  });

  it('highlights the rows Activity opened it on, opening the closed group when needed', () => {
    const { container } = mount({ section: 'decisions', highlight: [3, 7] });
    const highlighted = [...container.querySelectorAll('[data-decision].bg-selected')].map((node) =>
      node.getAttribute('data-decision'),
    );
    expect(highlighted.sort()).toEqual(['3', '7']);
    screen.getByText('Detect duplicates by hashing the payload');
  });

  it('keeps the closed group shut when no highlight asks for it', () => {
    mount({ section: 'decisions' });
    expect(screen.queryByText('Detect duplicates by hashing the payload')).toBeNull();
  });

  it('opens Versions inside the drawer, and Escape leaves the view before the drawer', () => {
    const onClose = vi.fn();
    mount({ section: 'summary', view: 'versions', onClose });
    screen.getByRole('button', { name: 'Summary' });
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(store.getState().drawer).toMatchObject({
      kind: 'context',
      payload: { section: 'summary', view: 'current' },
    });
  });

  it('keeps the decisions readable but not editable while the context updates', () => {
    setSummarizer({ status: 'running' });
    const { container } = mount({ section: 'decisions' });
    const row = container.querySelector<HTMLElement>('[data-decision="7"]');
    if (row === null) {
      throw new Error('Missing decision 7');
    }
    fireEvent.click(within(row).getByRole('button', { name: /^(Show|Hide) .+/ }));
    screen.getByText('Show the stuck-delivery banner after the third failed retry, not the first');
    expect(screen.queryByRole('button', { name: 'Edit decision 7' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove decision 7' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));
    expect(screen.getByRole('menuitem', { name: 'Edit' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it('opens a link in a decision without toggling the row, and still toggles by text and keyboard', () => {
    setLedger({
      ledger: [
        aDecision({
          sessionId: SESSION_ID,
          number: 1,
          text: 'Preview the build at [localhost:5173](http://localhost:5173/) before merging',
        }),
      ],
    });
    const { container } = mount({ section: 'decisions' });
    const row = container.querySelector<HTMLElement>('[data-decision="1"]');
    if (row === null) {
      throw new Error('Missing decision 1');
    }
    const toggle = within(row).getByRole('button', { name: 'Show decision 1 actions' });
    expect(toggle.closest('a')).toBeNull();
    expect(row.querySelector('button a')).toBeNull();
    const link = within(row).getByRole('link', { name: 'localhost:5173' });
    link.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(link);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(within(row).getByText(/Preview the build at/));
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(toggle, { key: 'Escape' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('says why an empty card is empty', () => {
    setSlots({ goal: '', decisions: '', summary: '' });
    setLedger({ ledger: [] });
    store.setState({ sessionContextItems: { [SESSION_ID]: [] } });
    mount();
    screen.getByText('No goal yet. Every agent starts from it.');
    screen.getByText('A summary appears after the first agent reply.');
    screen.getByText(
      'No decisions yet. Agents record one when they settle a choice; you can add your own.',
    );
    screen.getByText('Nothing yet. Agents explain the topics you follow.');
  });

  it('keeps the Goal menu on an empty Goal and on a Goal being edited', () => {
    setSlots({ goal: '', decisions: '', summary: 'x' });
    const empty = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));
    const menu = screen.getByRole('menu', { name: 'Goal actions' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Edit', 'Versions', 'Who reads this']);
    expect(screen.queryByText(/^All roles/)).toBeNull();
    empty.unmount();

    setSlots({ goal: 'Stop crediting an invoice twice.', decisions: '', summary: 'x' });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    screen.getByRole('textbox', { name: 'Goal' });
    fireEvent.click(screen.getByRole('button', { name: 'Goal actions' }));
    expect(screen.getByRole('menuitem', { name: 'Edit' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(screen.getByRole('menuitem', { name: 'Versions' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Who reads this' }));
    screen.getByText('Agents only.');
  });

  it('says Explanations are for you only', () => {
    mount();
    const section = document.querySelector<HTMLElement>('[data-context-section="explanations"]');
    if (section === null) {
      throw new Error('Missing Explanations');
    }
    within(section).getByText('You only');
  });
});

describe('Context updates in the drawer', () => {
  it('opens on the last round: model, usage and what changed', () => {
    setSummarizer({ status: 'idle' });
    store.setState({
      summarizerRounds: { [SESSION_ID]: ROUND },
      summarizerPending: { [SESSION_ID]: { turns: 2, isUpdateQueued: false } },
    });
    mount();
    fireEvent.click(contextUpdatesRow());
    expect(screen.getByRole('definition', { name: 'Last update' }).textContent).toContain(
      'after 3 replies',
    );
    expect(screen.getByRole('definition', { name: 'Model' }).textContent).toContain(
      'Haiku 4.5 · low effort',
    );
    expect(screen.getByRole('definition', { name: 'Used' }).textContent).toBe(
      '3,184 in · 412 out · about <$0.01',
    );
    expect(screen.getByRole('definition', { name: 'Changed' }).textContent).toBe(
      'Goal, 2 decisions, Summary',
    );
    fireEvent.click(screen.getByRole('button', { name: '2 decisions' }));
    expect(store.getState().drawer).toMatchObject({ payload: { section: 'decisions' } });
  });

  it('queues Update now in the session queue and shows it as queued', () => {
    setSummarizer({ status: 'idle' });
    store.setState({ summarizerRounds: { [SESSION_ID]: ROUND } });
    summarizerQueues.set(SESSION_ID, { inFlight: true, scheduled: null, queued: [] });
    mount();
    fireEvent.click(contextUpdatesRow());
    fireEvent.click(screen.getByRole('button', { name: 'Update now' }));
    expect(store.getState().summarizerPending[SESSION_ID]?.isUpdateQueued).toBe(true);
    expect(screen.getByRole('button', { name: 'Queued' }).hasAttribute('disabled')).toBe(true);
    expect(contextUpdatesRow().textContent).toContain('Queued');
  });

  it('says it is updating while the summarizer writes', () => {
    setSummarizer({ status: 'running' });
    mount();
    expect(contextUpdatesRow().textContent).toContain('Updating…');
  });

  it('sends Change model to the step summaries row in Models', () => {
    setSummarizer({ status: 'idle' });
    const opened = vi.fn();
    window.addEventListener('goodboy:open-settings', opened);
    mount();
    fireEvent.click(contextUpdatesRow());
    fireEvent.click(screen.getByRole('button', { name: 'Change model' }));
    window.removeEventListener('goodboy:open-settings', opened);
    const event = opened.mock.calls[0]?.[0];
    expect(event instanceof CustomEvent ? event.detail : null).toEqual({
      scope: 'providers',
      section: 'summarizer',
    });
  });
});
