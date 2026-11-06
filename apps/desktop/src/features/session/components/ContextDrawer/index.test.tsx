// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId, type IsoDateTime, type SessionDecision } from '@goodboy/types';
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

const mount = () =>
  render(
    <ContextDrawer
      sessionId={SESSION_ID}
      section="goal"
      view="current"
      onClose={() => undefined}
    />,
  );

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
    expect(screen.queryByRole('region', { name: 'State' })).toBeNull();
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
      '2 new turns since the last update.',
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
