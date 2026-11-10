// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { anAgent } from '@goodboy/types/testing';
import { EMPTY_SESSION_DRAFT } from '../../../store/slices/sessionDraft/state';
import {
  at,
  harborline,
  openQuestionFor,
  runningState,
  seedColumn,
  sessionOf,
} from '../../../features/workspace/testing/sessionColumn';
import { ColumnRail } from './ColumnRail';
import type { ColumnActions } from './columnDoors';
import type { ColumnPlace } from '../../../shared/navigation/columnPlace';

let useAppStore: StoryStore;
let realNavigate: ReturnType<StoryStore['getState']>['navigate'];

const actions = (): ColumnActions => ({
  openBoard: vi.fn(),
  openInbox: vi.fn(),
  openChat: vi.fn(),
  openWorkflows: vi.fn(),
  openNewChat: vi.fn(),
  openMonitoring: vi.fn(),
  openImpact: vi.fn(),
  openSettings: vi.fn(),
  openChangelog: vi.fn(),
  openGuide: vi.fn(),
});

beforeAll(async () => {
  useAppStore = await importStore();
  realNavigate = useAppStore.getState().navigate;
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ navigate: realNavigate });
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const open = sessionOf({ goal: 'Fix webhook retries', lastOpenedAt: '2026-10-06T09:00:00.000Z' });
const idOf = (session: Session) => session.id as SessionId;

const pinnedId = (pinned: ReadonlyArray<Session>, index: number): SessionId =>
  idOf(pinned[index] ?? open);

const pinnedSessions = (count: number, state?: Session['state']): ReadonlyArray<Session> =>
  Array.from({ length: count }, (_, index) =>
    sessionOf({
      goal: `Pinned work ${index + 1}`,
      state,
      lastOpenedAt: `2026-09-${String(10 + index).padStart(2, '0')}T09:00:00.000Z`,
    }),
  );

type RailParams = {
  readonly place?: ColumnPlace;
  readonly scope?: 'workspace' | 'app';
  readonly pinned?: ReadonlyArray<Session>;
  readonly currentSessionId?: SessionId | null;
};

const railOf = ({
  place = null,
  scope = 'workspace',
  currentSessionId = idOf(open),
}: RailParams = {}) => (
  <ColumnRail
    scope={scope}
    workspaceId={scope === 'workspace' ? harborline.id : null}
    currentSessionId={currentSessionId}
    place={place}
    actions={actions()}
  />
);

const mountRail = ({
  place = null,
  scope = 'workspace',
  pinned = [],
  currentSessionId = idOf(open),
}: RailParams = {}) => {
  seedColumn({ store: useAppStore, sessions: [open, ...pinned], currentSessionId });
  useAppStore.setState({
    sessionBranches: { [open.id]: 'goodboy/webhook-retries' },
    sessionPins: {
      [harborline.id]: pinned.map((session, index) => ({ id: idOf(session), at: index + 1 })),
    },
  });
  return render(railOf({ place, scope, currentSessionId }));
};

const showCurrent = ({
  rerender,
  sessionId,
}: {
  readonly rerender: (ui: React.ReactElement) => void;
  readonly sessionId: SessionId;
}) => {
  act(() => {
    useAppStore.setState({ currentSessionId: sessionId });
  });
  rerender(railOf({ currentSessionId: sessionId }));
};

const railOrder = (): ReadonlyArray<string | null> =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-rail-session]')).map((button) =>
    button.getAttribute('data-rail-session'),
  );

const currentNodes = (): ReadonlyArray<string | null> =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-rail-session]'))
    .filter((button) => button.getAttribute('aria-current') === 'page')
    .map((button) => button.getAttribute('data-rail-session'));

const wait = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const sessionButton = () => document.querySelector<HTMLElement>(`[data-rail-session="${open.id}"]`);

const flyout = () => document.querySelector<HTMLElement>('[data-rail-flyout]');

const hoverOpenSession = () => {
  fireEvent.mouseEnter(sessionButton() as HTMLElement);
  wait(200);
};

describe('the New button of the rail', () => {
  it('shows no dot without a draft', () => {
    mountRail();
    expect(document.querySelector('[data-slot="draft-dot"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'New session' })).toBeDefined();
  });

  it('shows the dot and says a draft is in progress while one waits elsewhere', () => {
    mountRail();
    act(() => {
      useAppStore.setState({
        sessionDrafts: {
          [harborline.id]: { ...EMPTY_SESSION_DRAFT, workflowGoal: 'Add rate limits' },
        },
      });
    });
    const button = screen.getByRole('button', { name: 'New session, draft in progress' });
    expect(button.querySelector('[data-slot="draft-dot"]')).not.toBeNull();
  });

  it('drops the dot while the draft itself is open', () => {
    mountRail({ place: 'new', currentSessionId: null });
    act(() => {
      useAppStore.setState({
        sessionDrafts: {
          [harborline.id]: { ...EMPTY_SESSION_DRAFT, workflowGoal: 'Add rate limits' },
        },
      });
    });
    expect(document.querySelector('[data-slot="draft-dot"]')).toBeNull();
  });
});

describe('the open session on the rail', () => {
  it('shows the session as a node button named by its title, current on its page', () => {
    mountRail();
    const button = sessionButton() as HTMLElement;
    expect(button.getAttribute('aria-label')).toContain('Fix webhook retries');
    expect(button.getAttribute('aria-current')).toBe('page');
  });

  it('is not a door and does not disturb the door list', () => {
    mountRail();
    const doors = Array.from(document.querySelectorAll('[data-column-door]')).map((door) =>
      door.getAttribute('data-column-door'),
    );
    expect(doors).toEqual([
      'new',
      'board',
      'inbox',
      'workflows',
      'chat',
      'impact',
      'monitoring',
      'settings',
    ]);
  });

  it('keeps resting sessions behind the count on the Board', () => {
    mountRail({ place: 'board', currentSessionId: null });
    expect(screen.getByRole('button', { name: '1 more session' }).textContent).toBe('+1');
    expect(document.querySelectorAll('[data-rail-session]')).toHaveLength(0);
  });

  it('shows nothing in the app scope', () => {
    mountRail({ scope: 'app', place: null, pinned: pinnedSessions(2) });
    expect(document.querySelector('[data-rail-sessions]')).toBeNull();
    expect(document.querySelector('[data-rail-session]')).toBeNull();
  });

  it('is remembered, without the current sign, while a studio sits over it', () => {
    mountRail({ place: 'inbox' });
    const button = sessionButton() as HTMLElement;
    expect(button.getAttribute('aria-current')).toBeNull();
    const navigate = vi.fn();
    useAppStore.setState({ navigate });
    fireEvent.click(button);
    expect(navigate).toHaveBeenCalledWith({
      to: expect.objectContaining({ at: 'session', sessionId: idOf(open) }),
    });
  });

  it('opens a flyout on hover that lists the pages of the session', () => {
    mountRail();
    expect(flyout()).toBeNull();
    hoverOpenSession();
    const card = within(flyout() as HTMLElement);
    const pages = within(card.getByRole('list', { name: 'Pages' }));
    expect(pages.getAllByRole('button').map((row) => row.textContent)).toEqual([
      'Overview',
      'Runs',
      'Artifacts',
      'Questions',
    ]);
    expect(pages.getByRole('button', { name: 'Overview' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('opens the page chosen in the flyout and closes it', () => {
    mountRail();
    hoverOpenSession();
    fireEvent.click(within(flyout() as HTMLElement).getByRole('button', { name: 'Runs' }));
    expect(useAppStore.getState().activeLens[open.id]).toBe('workflows');
    expect(flyout()).toBeNull();
  });

  it('opens on keyboard focus and closes on Escape, giving focus back to the button', () => {
    mountRail();
    const button = sessionButton() as HTMLElement;
    vi.spyOn(button, 'matches').mockImplementation(() => true);
    act(() => {
      button.focus();
    });
    expect(flyout()).not.toBeNull();
    act(() => {
      (within(flyout() as HTMLElement).getAllByRole('button')[0] as HTMLElement).focus();
    });
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    });
    expect(flyout()).toBeNull();
    expect(document.activeElement).toBe(button);
    wait(500);
    expect(flyout()).toBeNull();
  });

  it('lets the arrow keys walk from the button into the flyout and back', () => {
    mountRail();
    const button = sessionButton() as HTMLElement;
    hoverOpenSession();
    fireEvent.keyDown(button, { key: 'ArrowRight' });
    const first = within(flyout() as HTMLElement).getAllByRole('button')[0] as HTMLElement;
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).not.toBe(first);
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowLeft' });
    expect(flyout()).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('stays closed when the pointer leaves before the flyout rests', () => {
    mountRail();
    fireEvent.mouseEnter(sessionButton() as HTMLElement);
    wait(50);
    fireEvent.mouseLeave(sessionButton() as HTMLElement);
    wait(500);
    expect(flyout()).toBeNull();
  });
});

describe('the pinned sessions on the rail', () => {
  it('folds idle pinned sessions into +N and draws only the open session', () => {
    mountRail({ pinned: pinnedSessions(3) });
    expect(railOrder()).toEqual([open.id]);
    expect(document.querySelector<HTMLElement>('[data-rail-more]')?.textContent).toBe('+3');
  });

  it('orders needs you, then running, then unread, and counts what stays hidden', () => {
    const idle = pinnedSessions(3);
    const unread = sessionOf({ goal: 'Unread reply' });
    const running = sessionOf({ goal: 'Running work', state: runningState() });
    const needs = sessionOf({ goal: 'Needs an answer' });
    seedColumn({
      store: useAppStore,
      sessions: [open, unread, running, needs, ...idle],
      currentSessionId: idOf(open),
    });
    useAppStore.setState({
      sessionOpenQuestions: { [needs.id]: [openQuestionFor({ sessionId: idOf(needs) })] },
      sessionPhaseRuns: {
        [unread.id]: [
          anAgent({
            sessionId: idOf(unread),
            status: 'completed',
            lastFinishedAt: at('2026-10-06T09:00:00.000Z'),
          }),
        ],
      },
    });
    render(railOf());
    expect(railOrder()).toEqual([needs.id, running.id, unread.id, open.id]);
    expect(document.querySelector<HTMLElement>('[data-rail-more]')?.textContent).toBe('+3');
  });

  it('draws running sessions in order and an idle open session as one extra node after them', () => {
    const pinned = pinnedSessions(3, runningState());
    mountRail({ pinned });
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('[data-rail-session]'));
    expect(railOrder()).toEqual([...pinned.map((session) => session.id), open.id]);
    expect(buttons[0]?.getAttribute('aria-label')).toContain('Pinned work 1');
    const tail = document.querySelector('[data-slot="rail-open-tail"]');
    expect(tail?.getAttribute('data-rail-session')).toBe(open.id);
    expect(tail?.querySelector('[data-node-kind]')).not.toBeNull();
    expect(currentNodes()).toEqual([open.id]);
  });

  it('keeps the pin order whatever is open and moves only the marker', () => {
    const pinned = pinnedSessions(5, runningState());
    const { rerender } = mountRail({ pinned, currentSessionId: pinnedId(pinned, 0) });
    const order = pinned.map((session) => session.id);
    expect(railOrder()).toEqual(order);
    expect(currentNodes()).toEqual([order[0]]);
    expect(document.querySelector('[data-slot="rail-open-tail"]')).toBeNull();

    showCurrent({ rerender, sessionId: pinnedId(pinned, 3) });

    expect(railOrder()).toEqual(order);
    expect(currentNodes()).toEqual([order[3]]);
    expect(document.querySelector('[data-slot="rail-open-tail"]')).toBeNull();
  });

  it('adds the open session as a tail node when it is pinned beyond the limit', () => {
    const pinned = pinnedSessions(9, runningState());
    mountRail({ pinned, currentSessionId: pinnedId(pinned, 8) });
    const tail = document.querySelector('[data-slot="rail-open-tail"]');
    expect(tail?.getAttribute('data-rail-session')).toBe(pinned[8]?.id);
    expect(railOrder().slice(0, 7)).toEqual(pinned.slice(0, 7).map((session) => session.id));
    expect(document.querySelector<HTMLElement>('[data-rail-more]')?.textContent).toBe('+2');
  });

  it('opens the session hover card on a rested pin and closes it on leave', () => {
    const pinned = pinnedSessions(3, runningState());
    mountRail({ pinned, currentSessionId: pinnedId(pinned, 2) });
    const other = screen.getByRole('button', { name: /Pinned work 1/ });

    fireEvent.mouseEnter(other);
    wait(300);
    expect(screen.queryByTestId('session-hover-card')).toBeNull();

    wait(300);
    expect(screen.getByTestId('session-hover-card').textContent).toContain('Pinned work 1');

    fireEvent.mouseLeave(other);
    wait(400);
    expect(screen.queryByTestId('session-hover-card')).toBeNull();
  });

  it('opens the flyout from the current node and leaves the others to their hover card', () => {
    const pinned = pinnedSessions(5, runningState());
    mountRail({ pinned, currentSessionId: pinnedId(pinned, 3) });
    const other = document.querySelector(`[data-rail-session="${pinned[0]?.id}"]`) as HTMLElement;
    fireEvent.mouseEnter(other);
    wait(200);
    expect(flyout()).toBeNull();

    fireEvent.mouseEnter(
      document.querySelector(`[data-rail-session="${pinned[3]?.id}"]`) as HTMLElement,
    );
    wait(200);
    expect(flyout()).not.toBeNull();
  });

  it('shows seven pins and then +N for the rest, which opens every pin in a flyout', () => {
    const pinned = pinnedSessions(9, runningState());
    mountRail({ pinned });
    expect(document.querySelectorAll('[data-rail-session]')).toHaveLength(8);
    const more = document.querySelector<HTMLElement>('[data-rail-more]') as HTMLElement;
    expect(more.textContent).toBe('+2');
    fireEvent.click(more);
    const rows = within(flyout() as HTMLElement).getAllByRole('button');
    expect(rows).toHaveLength(10);
    expect(rows.map((row) => row.textContent)).toContain('Pinned work 9');
  });

  it('bounds the flyout to the window and scrolls to the row the arrows reach', () => {
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    mountRail({ pinned: pinnedSessions(30) });
    fireEvent.click(document.querySelector<HTMLElement>('[data-rail-more]') as HTMLElement);
    const card = flyout() as HTMLElement;
    expect(card.style.maxHeight).toBe(`${window.innerHeight - 16}px`);
    expect(card.querySelector('.overflow-y-auto')).not.toBeNull();
    const first = within(card).getAllByRole('button')[0] as HTMLElement;
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('shows no +N for seven pins or fewer', () => {
    mountRail({ pinned: pinnedSessions(7, runningState()) });
    expect(document.querySelector('[data-rail-more]')).toBeNull();
    expect(document.querySelectorAll('[data-rail-session]')).toHaveLength(8);
  });

  it('opens a pinned session from its button', () => {
    const pinned = pinnedSessions(2, runningState());
    mountRail({ pinned });
    const navigate = vi.fn();
    useAppStore.setState({ navigate });
    fireEvent.click(
      document.querySelector(`[data-rail-session="${pinned[1]?.id}"]`) as HTMLElement,
    );
    expect(navigate).toHaveBeenCalledWith({
      to: expect.objectContaining({ sessionId: pinned[1]?.id }),
    });
  });

  it('does not show the open session twice when it is pinned', () => {
    const pinned = pinnedSessions(2);
    mountRail({ pinned: [open, ...pinned] });
    const ids = Array.from(document.querySelectorAll('[data-rail-session]')).map((button) =>
      button.getAttribute('data-rail-session'),
    );
    expect(ids.filter((id) => id === open.id)).toHaveLength(1);
  });

  it('lists the pins in the flyout of the open session', () => {
    const pinned = pinnedSessions(2);
    mountRail({ pinned });
    hoverOpenSession();
    const card = within(flyout() as HTMLElement);
    expect(card.getByText('Sessions')).toBeDefined();
    expect(card.getByRole('button', { name: 'Pinned work 1' })).toBeDefined();
    expect(card.getByRole('button', { name: 'Pinned work 2' })).toBeDefined();
  });
});

const plainTooltips = () =>
  Array.from(document.querySelectorAll('[role="tooltip"]:not([data-hover-surface])'));

describe('one hover on a rail node shows one thing', () => {
  it('shows the hover card of a pin and never a tooltip with it', () => {
    const pinned = pinnedSessions(3, runningState());
    mountRail({ pinned, currentSessionId: pinnedId(pinned, 2) });
    const other = screen.getByRole('button', { name: /Pinned work 1/ });

    fireEvent.mouseEnter(other);
    wait(450);
    expect(plainTooltips()).toHaveLength(0);

    wait(100);
    expect(screen.getByTestId('session-hover-card').textContent).toContain('Pinned work 1');
    expect(plainTooltips()).toHaveLength(0);

    wait(1000);
    expect(plainTooltips()).toHaveLength(0);
  });

  it('keeps the unread summary in the hover card of an unread pin', () => {
    const unread = sessionOf({ goal: 'Unread reply' });
    seedColumn({ store: useAppStore, sessions: [open, unread], currentSessionId: idOf(open) });
    useAppStore.setState({
      sessionPhaseRuns: {
        [unread.id]: [
          anAgent({
            sessionId: idOf(unread),
            name: 'Reviewer',
            status: 'completed',
            outputSummary: 'Checked the ledger-core retry.',
            lastFinishedAt: at('2026-10-06T09:00:00.000Z'),
          }),
        ],
      },
    });
    render(railOf());
    const node = document.querySelector(`[data-rail-session="${unread.id}"]`);
    if (node === null) {
      throw new Error('expected the rail node to be drawn');
    }
    fireEvent.mouseEnter(node);
    wait(600);

    const card = screen.getByTestId('session-hover-card');
    expect(card.querySelector('[data-slot="unread-label"]')?.textContent).toBe(
      '1 new: Checked the ledger-core retry',
    );
  });

  it('keeps the unread summary in the flyout of the open node', () => {
    mountRail();
    useAppStore.setState({
      sessionPhaseRuns: {
        [open.id]: [
          anAgent({
            sessionId: idOf(open),
            name: 'Reviewer',
            status: 'completed',
            outputSummary: 'Checked the ledger-core retry.',
            lastFinishedAt: at('2026-10-06T09:00:00.000Z'),
          }),
        ],
      },
    });
    hoverOpenSession();

    expect(flyout()?.querySelector('[data-slot="unread-label"]')?.textContent).toBe(
      '1 new: Checked the ledger-core retry',
    );
  });

  it('shows the flyout of the open node and never a tooltip with it', () => {
    mountRail();
    hoverOpenSession();
    expect(flyout()).not.toBeNull();
    expect(plainTooltips()).toHaveLength(0);

    wait(1000);
    expect(plainTooltips()).toHaveLength(0);
  });
});
