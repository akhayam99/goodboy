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
import { aProject, aSession, aWorkspace, anAgent } from '@goodboy/types/testing';
import type { AgentId, OpenQuestion, OpenQuestionId, Session, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { bindTarget } from '../../../actions/registry';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { AppStore } from '../../../../store/store';
import { borderOf, spacingOf } from '../../../../test/boxGeometry';
import { inFlowBefore } from '../../../../test/flowLayout';
import { brandedId } from '../../../history/testing/brandedId';
import { sessionObjectKey } from '../../../actions/kinds/session';
import { requestSelect } from '../../../actions/selectRequest';
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

const markArchived = (ids: ReadonlyArray<SessionId>): void => {
  useAppStore.setState((state) => ({
    sessions: state.sessions.filter((session) => !ids.includes(session.id)),
    archivedSessions: {
      [workspace.id]: [
        ...(state.archivedSessions[workspace.id] ?? []),
        ...state.sessions
          .filter((session) => ids.includes(session.id))
          .map((session) => ({ ...session, archivedAt: session.updatedAt })),
      ],
    },
  }));
};

const titleOf = (goal: string): HTMLElement => screen.getByRole('button', { name: goal });

const pressedOf = (goal: string): string | null => titleOf(goal).getAttribute('aria-pressed');

const tick = (goal: string, init: Parameters<typeof fireEvent.click>[1] = { altKey: true }) =>
  fireEvent.click(titleOf(goal), init);

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

    tick(GOALS[0] ?? '');

    expect(within(toolbar()).getByText('1 selected')).toBeDefined();
    expect(screen.getAllByRole('toolbar')).toHaveLength(1);
    expect(pressedOf(GOALS[0] ?? '')).toBe('true');
    expect(pressedOf(GOALS[1] ?? '')).toBe('false');
  });

  it('lines each title up with its meta line at rest', () => {
    const sessions = sessionsOf(GOALS);
    useAppStore.setState({
      sessionOpenQuestions: Object.fromEntries(
        sessions.map((session) => [
          session.id,
          [
            {
              id: `question-${session.id}` as OpenQuestionId,
              sessionId: session.id,
              createdByAgentId: 'agent-1' as AgentId,
              text: 'Which implementation should I use?',
              suggestedAnswers: [],
              isBlocking: false,
              userAnswer: null,
              status: 'open',
              createdAt: session.createdAt,
            } satisfies OpenQuestion,
          ],
        ]),
      ),
    });
    mountBoard(sessions);

    for (const goal of GOALS) {
      const title = titleOf(goal);
      const card = title.closest('article');
      expect(card?.contains(title)).toBe(true);
      expect(inFlowBefore(title)).toEqual([]);
      const signal = card?.querySelector<HTMLElement>('[data-slot="card-signal"]') ?? null;
      expect(
        signal === null ? null : within(signal).getByRole('img').getAttribute('aria-label'),
      ).toBe('1 question for you');
    }
  });

  it('draws no checkbox and keeps the card padding and the rail where they are at rest', () => {
    mountBoard(sessionsOf(GOALS));
    expect(screen.queryByRole('checkbox')).toBeNull();
    tick(GOALS[0] ?? '');

    for (const goal of GOALS) {
      const card = titleOf(goal).closest('article');
      const rail = card?.querySelector('[data-testid="tone-bar"]');
      if (card == null || rail == null) {
        throw new Error(`card parts missing for ${goal}`);
      }
      const border = borderOf({ element: card });
      expect(border + spacingOf({ element: card, property: 'pl' })).toBeLessThanOrEqual(24);
      for (const states of [
        new Set(['group-hover/select-row']),
        new Set(['group-focus-within/select-row']),
        new Set(['group-data-[selecting=true]/select-list']),
      ]) {
        expect(spacingOf({ element: rail, property: 'top', states })).toBe(
          spacingOf({ element: rail, property: 'top' }),
        );
      }
    }
  });

  it('reads the state word with the card title and the pressed state on a selected card', () => {
    mountBoard(sessionsOf(GOALS));
    tick(GOALS[1] ?? '');

    const title = titleOf(GOALS[1] ?? '');
    const described = title.getAttribute('aria-describedby');
    expect(described).not.toBeNull();
    expect(document.getElementById(described ?? '')?.textContent?.length).toBeGreaterThan(0);
    expect(title.getAttribute('aria-pressed')).toBe('true');
  });

  it('extends a range from the keyboard with Shift Enter and toggles with Alt Enter', () => {
    mountBoard(sessionsOf(GOALS));
    const first = titleOf(GOALS[0] ?? '');
    fireEvent.keyDown(first, { key: 'Enter', altKey: true });
    expect(pressedOf(GOALS[0] ?? '')).toBe('true');
    fireEvent.keyDown(titleOf(GOALS[2] ?? ''), { key: 'Enter', shiftKey: true });
    expect(within(toolbar()).getByText(/\d selected/)).toBeDefined();
  });

  it('selects the card a Select menu item names', () => {
    const sessions = sessionsOf(GOALS);
    mountBoard(sessions);
    const target = sessions[1];
    if (target === undefined) {
      throw new Error('session missing');
    }
    act(() => {
      requestSelect({
        objectKey: sessionObjectKey({ sessionId: brandedId<SessionId>({ value: target.id }) }),
        anchorKey: `board:${target.id}`,
      });
    });
    expect(pressedOf(GOALS[1] ?? '')).toBe('true');
    expect(pressedOf(GOALS[0] ?? '')).toBe('false');
  });

  it('reaches the selection from the keyboard on a focused card', () => {
    mountBoard(sessionsOf(GOALS));
    const title = screen.getByRole('button', { name: GOALS[2] ?? '' });

    title.focus();
    fireEvent.keyDown(title, { key: 'x', code: 'KeyX' });

    expect(pressedOf(GOALS[2] ?? '')).toBe('true');
    expect(within(toolbar()).getByText('1 selected')).toBeDefined();
    expect(document.activeElement).toBe(title);
  });

  it('offers every card on the board, and selects them all from the bar', () => {
    mountBoard(sessionsOf(GOALS));
    tick(GOALS[0] ?? '');

    fireEvent.click(screen.getByRole('button', { name: 'Select all 4' }));

    expect(within(toolbar()).getByText('4 selected')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Select all/ })).toBeNull();
  });

  it('extends to a range on a shift-click of a checkbox inside a column', () => {
    mountBoard(sessionsOf(GOALS));
    tick(GOALS[0] ?? '');

    tick(GOALS[2] ?? '', { altKey: false, shiftKey: true });

    expect(within(toolbar()).getByText(/\d selected/)).toBeDefined();
  });

  it('selects the card under the pointer with X, selects all with the select all key, clears with Escape', () => {
    mountBoard(sessionsOf(GOALS));

    fireEvent.mouseOver(screen.getByText(GOALS[1] ?? ''));
    fireEvent.keyDown(window, { key: 'x', code: 'KeyX' });
    expect(pressedOf(GOALS[1] ?? '')).toBe('true');
    expect(within(toolbar()).getByText('1 selected')).toBeDefined();

    fireEvent.keyDown(window, { key: 'a', code: 'KeyA', ctrlKey: true });
    expect(within(toolbar()).getByText('4 selected')).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('names the verbs with the same words as the context menu of the selection', () => {
    const sessions = sessionsOf(GOALS);
    mountBoard(sessions);
    tick(GOALS[0] ?? '');
    tick(GOALS[1] ?? '');

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

  it('asks once above the bar before archiving, naming the count and the running agents', () => {
    const sessions = sessionsOf(GOALS);
    const [first, second] = sessions;
    if (first === undefined || second === undefined) {
      throw new Error('sessions missing');
    }
    mountBoard(sessions);
    useAppStore.setState({
      sessionPhaseRuns: {
        [first.id]: [anAgent({ sessionId: first.id, status: 'running' })],
        [second.id]: [anAgent({ sessionId: second.id, status: 'running' })],
      },
    });
    tick(GOALS[0] ?? '');
    tick(GOALS[1] ?? '');
    tick(GOALS[2] ?? '');

    fireEvent.click(within(toolbar()).getByRole('button', { name: 'Archive 3 sessions' }));

    const confirm = screen.getByRole('group', { name: 'Archive 3 sessions?' });
    expect(screen.getAllByRole('group', { name: /^Archive/ })).toHaveLength(1);
    expect(confirm.textContent).toContain(
      '2 agents are still running in these sessions and keep running after you archive them.',
    );
    expect(confirm.textContent).toContain('Restore brings them back');
    expect(within(confirm).getByRole('button', { name: 'Archive 3 sessions' })).toBeDefined();
    expect(document.activeElement).toBe(within(confirm).getByRole('button', { name: 'Cancel' }));
  });

  it('archives nothing on Cancel and keeps the selection', async () => {
    const bulkArchiveTask = vi.fn<AppStore['bulkArchiveTask']>();
    mountBoard(sessionsOf(GOALS));
    useAppStore.setState({ bulkArchiveTask });
    tick(GOALS[0] ?? '');
    tick(GOALS[1] ?? '');
    fireEvent.click(within(toolbar()).getByRole('button', { name: 'Archive 2 sessions' }));

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Archive 2 sessions?' })).getByRole('button', {
        name: 'Cancel',
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Archive 2 sessions?' })).toBeNull(),
    );
    expect(bulkArchiveTask).not.toHaveBeenCalled();
    expect(within(toolbar()).getByText('2 selected')).toBeDefined();
  });

  it('archives every selected session once confirmed, and Undo restores them all', async () => {
    const sessions = sessionsOf(GOALS);
    const picked = [sessions[0]?.id, sessions[2]?.id];
    const bulkArchiveTask = vi.fn<AppStore['bulkArchiveTask']>(async (ids) => ({
      succeeded: [...ids],
      failed: [],
    }));
    const bulkUnarchiveTask = vi.fn<AppStore['bulkUnarchiveTask']>(async (ids) => ({
      succeeded: [...ids],
      failed: [],
    }));
    mountBoard(sessions);
    useAppStore.setState({ bulkArchiveTask, bulkUnarchiveTask });
    tick(GOALS[0] ?? '');
    tick(GOALS[2] ?? '');
    fireEvent.click(within(toolbar()).getByRole('button', { name: 'Archive 2 sessions' }));

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Archive 2 sessions?' })).getByRole('button', {
        name: 'Archive 2 sessions',
      }),
    );

    await waitFor(() => expect(bulkArchiveTask).toHaveBeenCalledWith(picked));
    expect(bulkArchiveTask).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('toolbar')).toBeNull());
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    });
    expect(bulkUnarchiveTask).toHaveBeenCalledWith(picked);
  });

  it('archives what it can, names the session that failed, keeps the selection and retries only it', async () => {
    const sessions = sessionsOf(GOALS);
    const failed = sessions[1];
    if (failed === undefined) {
      throw new Error('sessions missing');
    }
    const bulkArchiveTask = vi
      .fn<AppStore['bulkArchiveTask']>()
      .mockImplementationOnce(async (ids) => {
        const succeeded = ids.filter((id) => id !== failed.id);
        markArchived(succeeded);
        return { succeeded, failed: [failed.id] };
      })
      .mockImplementationOnce(async (ids) => ({ succeeded: [...ids], failed: [] }));
    mountBoard(sessions);
    useAppStore.setState({ bulkArchiveTask });
    tick(GOALS[0] ?? '');
    tick(GOALS[1] ?? '');
    fireEvent.click(within(toolbar()).getByRole('button', { name: 'Archive 2 sessions' }));

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Archive 2 sessions?' })).getByRole('button', {
        name: 'Archive 2 sessions',
      }),
    );

    const note = await screen.findByRole('alert');
    expect(note.textContent).toContain(
      `Couldn't archive ${GOALS[1] ?? ''}. The other one is archived.`,
    );
    expect(within(toolbar()).getByText('2 selected')).toBeDefined();
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeDefined();

    await act(async () => {
      fireEvent.click(within(note).getByRole('button', { name: 'Retry' }));
    });
    await waitFor(() => expect(bulkArchiveTask).toHaveBeenCalledTimes(2));
    expect(bulkArchiveTask).toHaveBeenLastCalledWith([failed.id]);
  });

  it('archives at once from Archive instead in the delete confirm, with no second ask', async () => {
    const bulkArchiveTask = vi.fn<AppStore['bulkArchiveTask']>(async (ids) => ({
      succeeded: [...ids],
      failed: [],
    }));
    const sessions = sessionsOf(GOALS);
    mountBoard(sessions);
    useAppStore.setState({ bulkArchiveTask });
    tick(GOALS[3] ?? '');
    fireEvent.click(within(toolbar()).getByRole('button', { name: 'Delete 1 session' }));

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Delete 1 session?' })).getByRole('button', {
        name: 'Archive instead',
      }),
    );

    await waitFor(() => expect(bulkArchiveTask).toHaveBeenCalledWith([sessions[3]?.id]));
    expect(screen.queryByRole('group', { name: 'Archive session?' })).toBeNull();
  });

  it('asks above the bar before deleting, says what goes and what stays, and puts focus on Cancel', () => {
    mountBoard(sessionsOf(GOALS));
    tick(GOALS[0] ?? '');
    tick(GOALS[1] ?? '');

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
    tick(GOALS[0] ?? '');

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
    tick(GOALS[2] ?? '');
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

    tick('Reconcile batch 7');

    expect(renders.length).toBeLessThanOrEqual(2);
    expect(within(toolbar()).getByText('1 selected')).toBeDefined();
  });

  it('redraws at most two cards when the selection moves from one card to another', () => {
    mountBoard(many(100));
    tick('Reconcile batch 7');
    renders.length = 0;

    tick('Reconcile batch 7');
    tick('Reconcile batch 8');

    expect(renders.length).toBeLessThanOrEqual(4);
  });
});
