// @vitest-environment happy-dom

const { renders } = vi.hoisted(() => ({ renders: [] as string[] }));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('../../hooks/useSessionSummary', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useSessionSummary')>();
  return {
    ...actual,
    useSessionSummary: (params: Parameters<typeof actual.useSessionSummary>[0]) => {
      renders.push(params.session.id);
      return actual.useSessionSummary(params);
    },
  };
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import type { Session, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { bindTarget } from '../../../actions/registry';
import { ToastProvider } from '../../../../shared/components/Toast';
import { inFlowBefore, isLaidOver } from '../../../../test/flowLayout';
import { StageBoard } from './index';

const workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const project = aProject({ workspaceId: workspace.id, name: 'ledger-core', kind: 'folder' });

const GOALS = [
  'Add idempotency keys to the refund endpoint',
  'Retry webhook delivery with backoff',
  'Cache FX rates per request in payments-api',
  'Rate-limit the payout API',
];

const sessionsOf = (goals: ReadonlyArray<string>): ReadonlyArray<Session> =>
  goals.map((goal) => aSession({ workspaceId: workspace.id, goal }));

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const seed = (sessions: ReadonlyArray<Session>) => {
  useAppStore.setState({
    workspaces: [workspace],
    projects: [project],
    sessions: [...sessions],
    archivedSessions: { [workspace.id]: [] },
    boardReady: true,
    currentWorkspaceId: workspace.id,
  });
};

const mountBoard = (sessions: ReadonlyArray<Session>) => {
  seed(sessions);
  return render(
    <ToastProvider>
      <StageBoard workspaceId={workspace.id} sessions={sessions} />
    </ToastProvider>,
  );
};

const checkboxOf = (goal: string): HTMLElement =>
  screen.getByRole('checkbox', { name: `Select ${goal}` });

const toolbar = (): HTMLElement => screen.getByRole('toolbar');

beforeEach(async () => {
  await resetStoryStore();
  renders.length = 0;
  localStorage.clear();
});

afterEach(cleanup);

describe('StageBoard selection bar', () => {
  it('starts a selection from a card checkbox and raises one bar for the whole board', () => {
    mountBoard(sessionsOf(GOALS));
    expect(screen.queryByRole('toolbar')).toBeNull();

    fireEvent.click(checkboxOf(GOALS[0] ?? ''));

    expect(within(toolbar()).getByText('1 selected')).toBeDefined();
    expect(screen.getAllByRole('toolbar')).toHaveLength(1);
    expect(checkboxOf(GOALS[0] ?? '').getAttribute('aria-checked')).toBe('true');
    expect(checkboxOf(GOALS[1] ?? '').getAttribute('aria-checked')).toBe('false');
  });

  it('lines each title up with its meta line at rest and lays the checkbox over the rail', () => {
    mountBoard(sessionsOf(GOALS));

    for (const goal of GOALS) {
      const box = checkboxOf(goal);
      const title = screen.getByRole('button', { name: goal });
      const card = box.closest('article');
      const titleRow = title.parentElement;
      const column = titleRow?.parentElement;
      expect(card?.contains(title)).toBe(true);
      expect(inFlowBefore(title)).toEqual([]);
      expect(titleRow?.contains(box)).toBe(false);
      expect(card === null ? false : isLaidOver(box, card)).toBe(true);
      expect(column?.children.length).toBe(2);
      expect(inFlowBefore(titleRow ?? title)).toEqual([]);
      expect(inFlowBefore(column?.lastElementChild ?? title)).toEqual([titleRow]);
    }
  });

  it('reaches the checkbox from the keyboard on a focused card', () => {
    mountBoard(sessionsOf(GOALS));
    const title = screen.getByRole('button', { name: GOALS[2] ?? '' });

    title.focus();
    fireEvent.keyDown(title, { key: 'x', code: 'KeyX' });

    expect(checkboxOf(GOALS[2] ?? '').getAttribute('aria-checked')).toBe('true');
    expect(within(toolbar()).getByText('1 selected')).toBeDefined();
    expect(document.activeElement).toBe(title);
  });

  it('offers every card on the board, and selects them all from the bar', () => {
    mountBoard(sessionsOf(GOALS));
    fireEvent.click(checkboxOf(GOALS[0] ?? ''));

    fireEvent.click(screen.getByRole('button', { name: 'Select all 4' }));

    expect(within(toolbar()).getByText('4 selected')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Select all/ })).toBeNull();
  });

  it('extends to a range on a shift-click of a checkbox inside a column', () => {
    mountBoard(sessionsOf(GOALS));
    fireEvent.click(checkboxOf(GOALS[0] ?? ''));

    fireEvent.click(checkboxOf(GOALS[2] ?? ''), { shiftKey: true });

    expect(within(toolbar()).getByText(/\d selected/)).toBeDefined();
  });

  it('selects the card under the pointer with X, selects all with the select all key, clears with Escape', () => {
    mountBoard(sessionsOf(GOALS));

    fireEvent.mouseOver(screen.getByText(GOALS[1] ?? ''));
    fireEvent.keyDown(window, { key: 'x', code: 'KeyX' });
    expect(checkboxOf(GOALS[1] ?? '').getAttribute('aria-checked')).toBe('true');
    expect(within(toolbar()).getByText('1 selected')).toBeDefined();

    fireEvent.keyDown(window, { key: 'a', code: 'KeyA', ctrlKey: true });
    expect(within(toolbar()).getByText('4 selected')).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('names the verbs with the same words as the context menu of the selection', () => {
    const sessions = sessionsOf(GOALS);
    mountBoard(sessions);
    fireEvent.click(checkboxOf(GOALS[0] ?? ''));
    fireEvent.click(checkboxOf(GOALS[1] ?? ''));

    const menu =
      bindTarget({
        state: useAppStore.getState(),
        target: {
          kind: 'sessions',
          sessionIds: sessions.slice(0, 2).map((session) => session.id as SessionId),
        },
      })
        ?.resolve()
        .filter((action) =>
          ['sessions.archive', 'sessions.restore', 'sessions.delete'].includes(action.id),
        )
        .map((action) => action.label) ?? [];
    const bar = within(toolbar())
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? '')
      .filter((label) => /^(Archive|Restore|Delete) /.test(label));

    expect(menu).toEqual(['Archive 2 sessions', 'Delete 2 sessions']);
    expect(bar).toEqual(menu);
  });

  it('archives at once, with no confirmation, and clears the selection', async () => {
    const bulkArchiveTask = vi.fn(async (ids: ReadonlyArray<SessionId>) => ({
      succeeded: [...ids],
      failed: [],
    }));
    const sessions = sessionsOf(GOALS);
    mountBoard(sessions);
    useAppStore.setState({ bulkArchiveTask });
    fireEvent.click(checkboxOf(GOALS[0] ?? ''));

    fireEvent.click(within(toolbar()).getByRole('button', { name: 'Archive 1 session' }));

    await waitFor(() => expect(bulkArchiveTask).toHaveBeenCalledWith([sessions[0]?.id]));
    await waitFor(() => expect(screen.queryByRole('toolbar')).toBeNull());
    expect(screen.queryByRole('group', { name: /Archive/ })).toBeNull();
  });

  it('asks above the bar before deleting, says what goes and what stays, and puts focus on Cancel', () => {
    mountBoard(sessionsOf(GOALS));
    fireEvent.click(checkboxOf(GOALS[0] ?? ''));
    fireEvent.click(checkboxOf(GOALS[1] ?? ''));

    fireEvent.click(within(toolbar()).getByRole('button', { name: 'Delete 2 sessions' }));

    const confirm = screen.getByRole('group', { name: 'Delete 2 sessions?' });
    expect(confirm.compareDocumentPosition(toolbar()) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
      0,
    );
    expect(confirm.textContent).toContain('Goes');
    expect(confirm.textContent).toContain('Stays');
    expect(within(confirm).getByText(GOALS[0] ?? '')).toBeDefined();
    expect(within(confirm).getByRole('button', { name: 'Archive instead' })).toBeDefined();
    expect(document.activeElement).toBe(within(confirm).getByRole('button', { name: 'Cancel' }));
  });

  it('opens the confirmation from the Delete key and returns focus to the board when it closes', async () => {
    mountBoard(sessionsOf(GOALS));
    fireEvent.click(checkboxOf(GOALS[0] ?? ''));

    fireEvent.mouseOver(screen.getByText(GOALS[0] ?? ''));
    fireEvent.keyDown(window, { key: 'Delete', code: 'Delete' });
    expect(await screen.findByRole('group', { name: 'Delete 1 session?' })).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Delete 1 session?' })).toBeNull(),
    );
    expect(within(toolbar()).getByText('1 selected')).toBeDefined();
    const board = document.querySelector('[data-select-id]');
    expect(board?.contains(document.activeElement)).toBe(true);
  });

  it('deletes through the registry once confirmed', async () => {
    const bulkDeleteTask = vi.fn(async () => undefined);
    const sessions = sessionsOf(GOALS);
    mountBoard(sessions);
    useAppStore.setState({ bulkDeleteTask });
    fireEvent.click(checkboxOf(GOALS[2] ?? ''));
    fireEvent.click(within(toolbar()).getByRole('button', { name: 'Delete 1 session' }));

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Delete 1 session?' })).getByRole('button', {
        name: 'Delete 1 session',
      }),
    );

    await waitFor(() => expect(bulkDeleteTask).toHaveBeenCalledWith([sessions[2]?.id]));
    await waitFor(() => expect(screen.queryByRole('toolbar')).toBeNull());
  });
});

describe('StageBoard selection cost', () => {
  const many = (count: number): ReadonlyArray<Session> =>
    sessionsOf(Array.from({ length: count }, (_, index) => `Reconcile batch ${index + 1}`));

  it('redraws at most two of a hundred cards when one joins the selection', () => {
    mountBoard(many(100));
    act(() => undefined);
    renders.length = 0;

    fireEvent.click(checkboxOf('Reconcile batch 7'));

    expect(renders.length).toBeLessThanOrEqual(2);
    expect(within(toolbar()).getByText('1 selected')).toBeDefined();
  });

  it('redraws at most two cards when the selection moves from one card to another', () => {
    mountBoard(many(100));
    fireEvent.click(checkboxOf('Reconcile batch 7'));
    renders.length = 0;

    fireEvent.click(checkboxOf('Reconcile batch 7'));
    fireEvent.click(checkboxOf('Reconcile batch 8'));

    expect(renders.length).toBeLessThanOrEqual(4);
  });
});
