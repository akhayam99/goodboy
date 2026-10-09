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
import type { MountId, Session, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { EMPTY_SESSION_DRAFT } from '../../../store/slices/sessionDraft/state';
import {
  harborline,
  mountOf,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../../features/workspace/testing/sessionColumn';
import { ColumnRail } from './ColumnRail';
import type { ColumnActions } from './columnDoors';
import type { ColumnPlace } from './columnPlace';

let useAppStore: StoryStore;
let realNavigate: ReturnType<StoryStore['getState']>['navigate'];

const actions = (): ColumnActions => ({
  openBoard: vi.fn(),
  openInbox: vi.fn(),
  openChat: vi.fn(),
  openWorkflows: vi.fn(),
  openSettings: vi.fn(),
  openChangelog: vi.fn(),
  openShortcuts: vi.fn(),
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

const pinnedSessions = (count: number): ReadonlyArray<Session> =>
  Array.from({ length: count }, (_, index) =>
    sessionOf({
      goal: `Pinned work ${index + 1}`,
      lastOpenedAt: `2026-09-${String(10 + index).padStart(2, '0')}T09:00:00.000Z`,
    }),
  );

type RailParams = {
  readonly place?: ColumnPlace;
  readonly scope?: 'workspace' | 'app';
  readonly pinned?: ReadonlyArray<Session>;
  readonly currentSessionId?: SessionId | null;
};

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
  return render(
    <ColumnRail
      scope={scope}
      workspaceId={scope === 'workspace' ? harborline.id : null}
      currentSessionId={currentSessionId}
      place={place}
      onToggle={vi.fn()}
      actions={actions()}
    />,
  );
};

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
    expect(doors).toEqual(['new', 'board', 'inbox', 'chat', 'workflows', 'settings']);
  });

  it('shows nothing on the Board, where no session is open', () => {
    mountRail({ place: 'board', currentSessionId: null });
    expect(document.querySelector('[data-rail-sessions]')).toBeNull();
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
      'Branch',
      'Runs',
      'Agents',
      'Artifacts',
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
  it('shows one node button per pin under the open session, in pin order', () => {
    const pinned = pinnedSessions(3);
    mountRail({ pinned });
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('[data-rail-session]'));
    expect(buttons.map((button) => button.getAttribute('data-rail-session'))).toEqual([
      open.id,
      ...pinned.map((session) => session.id),
    ]);
    expect(buttons[1]?.getAttribute('aria-label')).toContain('Pinned work 1');
  });

  it('shows seven pins and then +N for the rest, which opens every pin in a flyout', () => {
    const pinned = pinnedSessions(9);
    mountRail({ pinned });
    expect(document.querySelectorAll('[data-rail-session]')).toHaveLength(8);
    const more = document.querySelector<HTMLElement>('[data-rail-more]') as HTMLElement;
    expect(more.textContent).toBe('+2');
    fireEvent.click(more);
    const rows = within(flyout() as HTMLElement).getAllByRole('button');
    expect(rows).toHaveLength(9);
    expect(rows.map((row) => row.textContent)).toContain('Pinned work 9');
  });

  it('shows no +N for seven pins or fewer', () => {
    mountRail({ pinned: pinnedSessions(7) });
    expect(document.querySelector('[data-rail-more]')).toBeNull();
    expect(document.querySelectorAll('[data-rail-session]')).toHaveLength(8);
  });

  it('opens a pinned session from its button', () => {
    const pinned = pinnedSessions(2);
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
    expect(card.getByText('Pinned')).toBeDefined();
    expect(card.getByRole('button', { name: 'Pinned work 1' })).toBeDefined();
    expect(card.getByRole('button', { name: 'Pinned work 2' })).toBeDefined();
  });
});

describe('the branches in the flyout of the open session', () => {
  const withBranches = (count: number) => {
    const mounts = Array.from({ length: count }, (_, index) => ({
      ...mountOf({ session: open, project: paymentsApi }),
      mountId: `mount-rail-${index}` as MountId,
      worktreePath: `/tmp/payments-api/worktrees/${index}`,
      branch: `hl/branch-${index}`,
      parallelIndex: index,
    }));
    useAppStore.setState({ sessionProjectMounts: { [open.id]: mounts } });
  };

  it('lists one row per branch when the session has several', () => {
    mountRail();
    withBranches(3);
    hoverOpenSession();
    const list = within(flyout() as HTMLElement).getByRole('list', { name: 'Branches' });
    expect(within(list).getAllByRole('button')).toHaveLength(3);
  });

  it('lists none for a single branch', () => {
    mountRail();
    withBranches(1);
    hoverOpenSession();
    expect(within(flyout() as HTMLElement).queryByRole('list', { name: 'Branches' })).toBeNull();
  });
});
