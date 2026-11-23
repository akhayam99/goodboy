// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    listLiveSessionIds: vi.fn(async () => []),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => undefined),
    getSessionDockGrid: vi.fn(async (): Promise<string | null> => null),
  }),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { getSessionDockGrid, getSetting, listLiveSessionIds, setSetting } from '@goodboy/db';
import { brandId, type Session, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { pressShortcut } from '../../../../__tests__/helpers/pressKey';
import { stageInfosOf } from '../../../../store/slices/session-view/stageInfosOf';
import { needsYouOf } from '../../../board/queue/needsYouOf';
import { useQueueSends } from '../../../board/queue/QueueBoard/useQueueSends';
import {
  harborline,
  ledgerCore,
  notifyRelay,
  paymentsApi,
  runningState,
  seedColumn,
  sessionOf,
} from '../../testing/sessionColumn';
import { SessionsPopover } from '.';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

let storedPins: string | null = null;

type WriteParams = {
  readonly params: unknown;
};

const writtenValueOf = ({ params }: WriteParams): string | null =>
  typeof params === 'object' &&
  params !== null &&
  'value' in params &&
  typeof params.value === 'string'
    ? params.value
    : null;

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  storedPins = null;
  storySpies.getWorkspaceValue.mockImplementation(async () => storedPins);
  storySpies.insertWorkspaceValueIfAbsent.mockImplementation(async (params) => {
    storedPins = writtenValueOf({ params });
    return true;
  });
  storySpies.replaceWorkspaceValueIfUnchanged.mockImplementation(async (params) => {
    storedPins = writtenValueOf({ params });
    return true;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ask = sessionOf({ goal: 'Warn merchants before a payout hold' });
const running = sessionOf({ goal: 'Speed up the payout export', state: runningState() });
const pinned = sessionOf({ goal: 'Stop retried webhooks posting twice' });
const quiet = sessionOf({ goal: 'Rotate the processor signing secret' });

type IdParams = {
  readonly session: Session;
};

const idOf = ({ session }: IdParams): SessionId => brandId<SessionId>({ value: session.id });

type MountParams = {
  readonly questions?: ReadonlyArray<Session>;
};

const mount = ({ questions = [ask] }: MountParams = {}) => {
  seedColumn({
    store: useAppStore,
    sessions: [ask, running, pinned, quiet],
    questions,
    mounts: [
      [ask, notifyRelay],
      [running, ledgerCore],
      [pinned, paymentsApi],
      [quiet, paymentsApi],
    ],
  });
  const pins = [{ id: idOf({ session: pinned }), at: 1 }];
  storedPins = JSON.stringify(pins);
  vi.mocked(listLiveSessionIds).mockResolvedValue(
    [ask, running, pinned, quiet].map((session) => idOf({ session })),
  );
  useAppStore.setState({ boardReady: true, sessionPins: { [harborline.id]: pins } });
  return render(<SessionsPopover />);
};

const toggle = () => {
  act(() => {
    pressShortcut({ id: 'sessions.toggle', target: document.body });
  });
};

const dialog = (): HTMLElement => screen.getByRole('dialog', { name: 'Sessions' });

const groupNames = (): ReadonlyArray<string> =>
  within(dialog())
    .getAllByRole('group')
    .map((group) => group.firstElementChild?.textContent ?? '');

type GroupParams = {
  readonly name: RegExp;
};

const titlesIn = ({ name }: GroupParams): ReadonlyArray<string> =>
  within(within(dialog()).getByRole('group', { name }))
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');

const search = (): HTMLElement =>
  within(dialog()).getByRole('combobox', { name: 'Search sessions' });

describe('the Sessions popover in the bar', () => {
  it('opens and closes with the Sessions key from anywhere', () => {
    mount();
    expect(screen.queryByRole('dialog', { name: 'Sessions' })).toBeNull();

    toggle();
    dialog();
    expect(screen.getByRole('button', { name: 'Sessions' }).getAttribute('aria-expanded')).toBe(
      'true',
    );

    toggle();
    expect(screen.queryByRole('dialog', { name: 'Sessions' })).toBeNull();
  });

  it('puts Pinned first, then the sessions by state with their counts', () => {
    mount();
    toggle();

    expect(groupNames()).toEqual(['Pinned1', 'Needs you1', 'Running1', 'Building1']);
    expect(titlesIn({ name: /^Pinned/ })).toEqual([
      expect.stringContaining('Stop retried webhooks posting twice'),
    ]);
    expect(titlesIn({ name: /^Needs you/ })[0]).toContain('notify-relay');
  });

  it('filters by title or project as you type and says when nothing matches', () => {
    mount();
    toggle();

    fireEvent.change(search(), { target: { value: 'payout' } });
    expect(within(dialog()).getAllByRole('option')).toHaveLength(2);
    expect(groupNames()).toEqual(['Needs you1', 'Running1']);

    fireEvent.change(search(), { target: { value: 'payments-api' } });
    expect(within(dialog()).getAllByRole('option')).toHaveLength(2);

    fireEvent.change(search(), { target: { value: 'nothing like this' } });
    expect(within(dialog()).queryAllByRole('option')).toHaveLength(0);
    within(dialog()).getByText('No session matches nothing like this');
  });

  it('opens the active row with Enter after the arrows move it, and closes', () => {
    mount();
    toggle();

    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    const options = within(dialog()).getAllByRole('option');
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    expect(search().getAttribute('aria-activedescendant')).toBe(options[1]?.id);

    fireEvent.keyDown(search(), { key: 'Enter' });

    expect(useAppStore.getState().currentSessionId).toBe(idOf({ session: ask }));
    expect(screen.queryByRole('dialog', { name: 'Sessions' })).toBeNull();
  });

  it('moves a row into Pinned with its pin and back out again', async () => {
    mount();
    toggle();
    const quietRow = within(dialog())
      .getAllByRole('option')
      .find((option) => option.textContent?.includes('Rotate the processor') === true);
    const pin = quietRow?.querySelector<HTMLElement>('[data-sessions-pin="off"]');
    expect(pin).not.toBeNull();
    if (pin == null) {
      return;
    }

    fireEvent.click(pin);

    await waitFor(() =>
      expect(titlesIn({ name: /^Pinned/ })).toEqual([
        expect.stringContaining('Stop retried webhooks'),
        expect.stringContaining('Rotate the processor'),
      ]),
    );
    screen.getByRole('dialog', { name: 'Sessions' });
    expect(useAppStore.getState().currentSessionId).toBeNull();

    const unpin = within(within(dialog()).getByRole('group', { name: /^Pinned/ }))
      .getAllByRole('option')[1]
      ?.querySelector<HTMLElement>('[data-sessions-pin="on"]');
    if (unpin == null) {
      throw new Error('the pinned row has no pin');
    }
    fireEvent.click(unpin);

    await waitFor(() => expect(titlesIn({ name: /^Building/ })).toHaveLength(1));
  });

  it('leaves the row where it was when the pin cannot be saved', async () => {
    storySpies.replaceWorkspaceValueIfUnchanged.mockResolvedValue(false);
    mount();
    toggle();
    const pin = within(within(dialog()).getByRole('group', { name: /^Building/ }))
      .getAllByRole('option')[0]
      ?.querySelector<HTMLElement>('[data-sessions-pin="off"]');
    if (pin == null) {
      throw new Error('the building row has no pin');
    }

    await act(async () => {
      fireEvent.click(pin);
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(storySpies.replaceWorkspaceValueIfUnchanged).toHaveBeenCalledTimes(2),
    );
    expect(titlesIn({ name: /^Building/ })).toEqual([
      expect.stringContaining('Rotate the processor'),
    ]);
    expect(
      (useAppStore.getState().sessionPins[harborline.id] ?? []).map((pinEntry) => pinEntry.id),
    ).not.toContain(idOf({ session: quiet }));
  });
});

describe('what each Sessions row says', () => {
  const DESK_ROW = JSON.stringify({ version: 1, face: 'desk' });

  beforeEach(() => {
    vi.mocked(getSessionDockGrid).mockReset();
    vi.mocked(getSessionDockGrid).mockResolvedValue(null);
    useQueueSends.setState({ notNow: new Set(), pending: {} });
  });

  const rowOf = ({ session }: IdParams): HTMLElement => {
    const row = within(dialog())
      .getAllByRole('option')
      .find((option) => option.textContent?.includes(session.goal) === true);
    if (row === undefined) {
      throw new Error(`no row for ${session.goal}`);
    }
    return row;
  };

  const queueMovesOf = ({ session }: IdParams) => {
    const state = useAppStore.getState();
    return needsYouOf({
      sessions: [session],
      infos: stageInfosOf({ state, sessions: [session] }),
      openQuestions: { [session.id]: state.sessionOpenQuestions[idOf({ session })] ?? [] },
      notNow: useQueueSends.getState().notNow,
    });
  };

  it('counts what waits on you with the number the Queue shows', () => {
    mount();
    toggle();
    const { moveCount } = queueMovesOf({ session: ask });

    expect(moveCount).toBeGreaterThan(0);
    expect(within(rowOf({ session: ask })).getByTestId('sessions-needs-you').textContent).toBe(
      String(moveCount),
    );
    expect(
      within(rowOf({ session: ask })).queryByRole('img', {
        name: `${moveCount} ${moveCount === 1 ? 'item needs' : 'items need'} you`,
      }),
    ).not.toBeNull();
    expect(within(rowOf({ session: quiet })).queryByTestId('sessions-needs-you')).toBeNull();
  });

  it('drops a move put off with Not now, as the Queue does', () => {
    mount();
    toggle();
    const { moves } = queueMovesOf({ session: ask });

    act(() => {
      moves.forEach((move) => useQueueSends.getState().hide({ moveId: move.id }));
    });

    expect(within(rowOf({ session: ask })).queryByTestId('sessions-needs-you')).toBeNull();
  });

  it('drops a queued move from its own row only, and counts it again after Undo', () => {
    mount({ questions: [ask, pinned] });
    toggle();
    const countOf = ({ session }: IdParams): string | null =>
      within(rowOf({ session })).queryByTestId('sessions-needs-you')?.textContent ?? null;
    const askMoves = queueMovesOf({ session: ask });
    const pinnedCount = countOf({ session: pinned });
    const before = countOf({ session: ask });
    const [move] = askMoves.moves;
    if (move === undefined || pinnedCount === null) {
      throw new Error('both sessions need a move');
    }
    expect(before).toBe(String(askMoves.moveCount));

    act(() => {
      useQueueSends.getState().queue({
        send: { id: 'send-1', kind: 'answer', agentId: null, moveId: move.id },
        run: async () => undefined,
      });
    });

    const left = askMoves.moveCount - 1;
    expect(countOf({ session: ask })).toBe(left === 0 ? null : String(left));
    expect(countOf({ session: pinned })).toBe(pinnedCount);

    act(() => {
      useQueueSends.getState().cancel({ id: 'send-1' });
    });

    expect(countOf({ session: ask })).toBe(before);
    expect(countOf({ session: pinned })).toBe(pinnedCount);
  });

  it('says Desk for a session saved on the Desk and nothing for the others', async () => {
    vi.mocked(getSessionDockGrid).mockImplementation(async ({ sessionId }) =>
      sessionId === idOf({ session: pinned }) ? DESK_ROW : null,
    );
    mount();
    toggle();

    await waitFor(() =>
      expect(within(rowOf({ session: pinned })).queryByText('Desk')).not.toBeNull(),
    );
    expect(rowOf({ session: quiet }).querySelector('[data-sessions-face]')).toBeNull();
    expect(useAppStore.getState().sessionFace[idOf({ session: quiet })]).toBe('overview');
  });

  it('reads no row for a session whose face this window already knows', async () => {
    useAppStore.setState({ sessionFace: { [idOf({ session: running })]: 'desk' } });
    mount();
    toggle();

    expect(within(rowOf({ session: running })).queryByText('Desk')).not.toBeNull();
    await waitFor(() => expect(getSessionDockGrid).toHaveBeenCalled());
    expect(
      vi.mocked(getSessionDockGrid).mock.calls.map(([params]) => params.sessionId),
    ).not.toContain(idOf({ session: running }));
  });

  it('shows no face when the read fails, and reads again the next time Sessions opens', async () => {
    vi.mocked(getSessionDockGrid).mockRejectedValue(new Error('database is locked'));
    mount();
    toggle();
    await waitFor(() => expect(getSessionDockGrid).toHaveBeenCalled());
    expect(rowOf({ session: pinned }).querySelector('[data-sessions-face]')).toBeNull();
    toggle();

    vi.mocked(getSessionDockGrid).mockReset();
    vi.mocked(getSessionDockGrid).mockImplementation(async ({ sessionId }) =>
      sessionId === idOf({ session: pinned }) ? DESK_ROW : null,
    );
    toggle();

    await waitFor(() =>
      expect(within(rowOf({ session: pinned })).queryByText('Desk')).not.toBeNull(),
    );
  });

  it('reads an inactive row again after focus, so a face saved in another window shows', async () => {
    vi.mocked(getSessionDockGrid).mockImplementation(async ({ sessionId }) =>
      sessionId === idOf({ session: pinned }) ? DESK_ROW : null,
    );
    mount();
    toggle();
    await waitFor(() =>
      expect(within(rowOf({ session: pinned })).queryByText('Desk')).not.toBeNull(),
    );

    vi.mocked(getSessionDockGrid).mockResolvedValue(null);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() =>
      expect(rowOf({ session: pinned }).querySelector('[data-sessions-face]')).toBeNull(),
    );

    toggle();
    vi.mocked(getSessionDockGrid).mockImplementation(async ({ sessionId }) =>
      sessionId === idOf({ session: pinned }) ? DESK_ROW : null,
    );
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    toggle();
    await waitFor(() =>
      expect(within(rowOf({ session: pinned })).queryByText('Desk')).not.toBeNull(),
    );
  });

  it('keeps the face of the open session on focus, so an unsaved switch is not undone', async () => {
    mount();
    useAppStore.setState({
      currentSessionId: idOf({ session: quiet }),
      sessionFace: { [idOf({ session: quiet })]: 'desk' },
    });
    toggle();
    await waitFor(() => expect(getSessionDockGrid).toHaveBeenCalled());
    vi.mocked(getSessionDockGrid).mockClear();

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(getSessionDockGrid).toHaveBeenCalled());
    expect(
      vi.mocked(getSessionDockGrid).mock.calls.map(([params]) => params.sessionId),
    ).not.toContain(idOf({ session: quiet }));
    expect(useAppStore.getState().sessionFace[idOf({ session: quiet })]).toBe('desk');
  });
});

describe('the one-time Sessions card', () => {
  const card = (): HTMLElement | null =>
    screen.queryByRole('dialog', { name: 'Your sessions moved here' });

  it('shows once under the control and says where sessions went', () => {
    useAppStore.setState({ sessionsCardPhase: 'open' });
    mount();
    expect(card()?.textContent).toContain('The sidebar list is gone.');
    expect(card()?.textContent).toContain('Press');
  });

  it('stays away on a fresh install and after it was closed', () => {
    useAppStore.setState({ sessionsCardPhase: 'closed' });
    mount();
    expect(card()).toBeNull();
  });

  it('closes for good the first time Sessions opens, with the key', async () => {
    useAppStore.setState({ sessionsCardPhase: 'open' });
    mount();
    toggle();
    await waitFor(() => expect(useAppStore.getState().sessionsCardPhase).toBe('closed'));
    expect(setSetting).toHaveBeenCalledWith(expect.anything(), 'shell.sessionsCardClosed', '1');
    toggle();
    expect(card()).toBeNull();
  });

  it('opens Sessions from Show sessions and closes the card', async () => {
    useAppStore.setState({ sessionsCardPhase: 'open' });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Show sessions' }));
    expect(dialog()).toBeTruthy();
    await waitFor(() => expect(useAppStore.getState().sessionsCardPhase).toBe('closed'));
    expect(card()).toBeNull();
  });

  it('comes back after a failed save once Sessions closes, and the next open retries', async () => {
    vi.mocked(setSetting).mockRejectedValueOnce(new Error('disk full'));
    useAppStore.setState({ sessionsCardPhase: 'open', reportError: vi.fn(async () => undefined) });
    mount();
    toggle();
    await waitFor(() => expect(useAppStore.getState().reportError).toHaveBeenCalledTimes(1));
    expect(useAppStore.getState().sessionsCardPhase).toBe('open');
    toggle();
    expect(card()).not.toBeNull();
    toggle();
    await waitFor(() => expect(useAppStore.getState().sessionsCardPhase).toBe('closed'));
  });

  it('closes when another window already saved the close and this one regains focus', async () => {
    useAppStore.setState({ sessionsCardPhase: 'open' });
    mount();
    expect(card()).not.toBeNull();
    vi.mocked(getSetting).mockResolvedValueOnce('1');
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(card()).toBeNull());
  });
});
