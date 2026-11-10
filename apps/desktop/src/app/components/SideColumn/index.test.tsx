// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { COLLAPSED_RAIL_WIDTH } from '@goodboy/ui';
import { aWorkspace } from '@goodboy/types/testing';
import type { ChatId, ChatMessageId, ProviderRunId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { OPEN_REPORT_SHEET_EVENT } from '../../../features/bug-report/openReportSheet';
import { brandedId } from '../../../features/history/testing/brandedId';
import type { TerminalTabId } from '../../../shared/types/terminal';
import { ColumnRail } from './ColumnRail';
import { SideColumn } from './index';
import { COLUMN_ROW_DOORS, type ColumnActions } from './columnDoors';
import type { ColumnPlace } from './columnPlace';

const WORKSPACE = aWorkspace({ name: 'Harborline' });

let useAppStore: StoryStore;

const actions = (): ColumnActions => ({
  openBoard: vi.fn(),
  openInbox: vi.fn(),
  openChat: vi.fn(),
  openWorkflows: vi.fn(),
  openTerminalStudio: vi.fn(),
  openBrowserStudio: vi.fn(),
  openNewChat: vi.fn(),
  openMonitoring: vi.fn(),
  openImpact: vi.fn(),
  openSettings: vi.fn(),
  openChangelog: vi.fn(),
  openGuide: vi.fn(),
});

type MountParams = {
  readonly place?: ColumnPlace;
  readonly scope?: 'workspace' | 'app';
  readonly doors?: ColumnActions;
  readonly isPeek?: boolean;
};

const mountColumn = ({
  place = 'board',
  scope = 'workspace',
  doors = actions(),
  isPeek = false,
}: MountParams = {}) =>
  render(
    <SideColumn
      scope={scope}
      workspaceId={scope === 'workspace' ? WORKSPACE.id : null}
      currentSessionId={null}
      place={place}
      actions={doors}
      isPeek={isPeek}
    />,
  );

const navLayer = (): HTMLElement =>
  document.querySelector('[data-column-layer="nav"]') as HTMLElement;

const doorNames = (root: HTMLElement): ReadonlyArray<string> =>
  Array.from(root.querySelectorAll('[data-column-door]')).map(
    (door) => door.getAttribute('data-column-door') ?? '',
  );

const currentDoors = (root: HTMLElement): ReadonlyArray<string> =>
  Array.from(root.querySelectorAll('[data-column-door][aria-current="page"]')).map(
    (door) => door.getAttribute('data-column-door') ?? '',
  );

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    archivedSessions: { [WORKSPACE.id]: [] },
    chatStreams: {},
    unreadChatIds: [],
  });
});

afterEach(cleanup);

describe('SideColumn', () => {
  it('stacks New session, five door rows, one row of tool tiles, the sessions, then Settings and the Goodboy row, the toggle left to the top bar', () => {
    mountColumn();
    const nav = navLayer();

    expect(within(nav).queryByRole('button', { name: /^Hide sidebar/ })).toBeNull();
    expect(within(nav).getAllByRole('button')[0]?.getAttribute('aria-label')).toMatch(
      /^New session/,
    );
    expect(doorNames(nav)).toEqual([
      'board',
      'inbox',
      'workflows',
      'chat',
      'impact',
      'terminal',
      'browser',
      'monitoring',
      'settings',
    ]);
    expect(
      Array.from(nav.querySelectorAll('[data-column-door-row]')).map((row) =>
        row.getAttribute('data-column-door-row'),
      ),
    ).toEqual(['board', 'inbox', 'workflows', 'chat', 'impact', 'settings']);
    expect(
      Array.from(nav.querySelectorAll('[data-column-tiles] [data-column-tile]')).map((tile) =>
        tile.getAttribute('data-column-tile'),
      ),
    ).toEqual(['terminal', 'browser', 'monitoring']);
    expect(nav.querySelector('[data-column-sessions]')).not.toBeNull();
    const foot = nav.querySelector('[data-column-foot]') as HTMLElement;
    expect(within(foot).getByRole('button', { name: 'Settings' })).toBeDefined();
    expect(within(foot).getByTestId('goodboy-chip')).toBeDefined();
    expect(within(foot).getByRole('button', { name: 'Report a bug' })).toBeDefined();
  });

  it('keeps Settings on line one and the Goodboy line and the bug icon on line two', () => {
    mountColumn();
    const foot = navLayer().querySelector<HTMLElement>('[data-column-foot]');
    const corner = foot?.querySelector<HTMLElement>('[data-column-corner]');
    if (foot === null || corner === null || corner === undefined) {
      throw new Error('no column foot');
    }

    expect(foot.firstElementChild?.getAttribute('data-column-door-row')).toBe('settings');
    expect(within(corner).getByTestId('goodboy-chip')).toBeDefined();
    expect(within(corner).getByRole('button', { name: 'Report a bug' })).toBeDefined();
    const chip = within(corner).getByTestId('goodboy-chip');
    const bug = within(corner).getByRole('button', { name: 'Report a bug' });
    expect(chip.compareDocumentPosition(bug) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('opens Help from the Goodboy line and lights it while Help is open', () => {
    const doors = actions();
    const { unmount } = mountColumn({ doors });

    fireEvent.click(screen.getByTestId('goodboy-chip'));

    expect(doors.openGuide).toHaveBeenCalledOnce();
    expect(screen.getByTestId('goodboy-chip').getAttribute('aria-current')).toBeNull();
    unmount();
    mountColumn({ place: 'help', doors });
    expect(screen.getByTestId('goodboy-chip').getAttribute('aria-current')).toBe('page');
    expect(currentDoors(navLayer())).toEqual([]);
  });

  it('names a live terminal on the Terminal tile and counts it, with no running dot', () => {
    useAppStore.setState({
      terminalTabs: {
        [WORKSPACE.id]: [
          {
            id: brandedId<TerminalTabId>({ value: 'tab-1' }),
            owner: { kind: 'workspace', workspaceId: WORKSPACE.id },
            title: 'dev',
            cwd: null,
            status: 'running',
            createdAt: 1,
          },
        ],
      },
    });
    mountColumn({ place: 'terminal' });

    const door = screen.getByRole('button', { name: 'Terminal, 1 running' });
    expect(door.querySelector('[data-door-signal]')).toBeNull();
    expect(door.querySelector('[data-tile-count]')?.textContent).toBe('1');
    expect(screen.queryByRole('button', { name: 'New terminal' })).toBeNull();
  });

  it('has Browser and Monitoring tiles after Terminal that open their pages', () => {
    const doors = actions();
    mountColumn({ doors });

    fireEvent.click(screen.getByRole('button', { name: /^Browser/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Monitoring/ }));

    expect(doors.openBrowserStudio).toHaveBeenCalledOnce();
    expect(doors.openMonitoring).toHaveBeenCalledOnce();
    expect(doorNames(navLayer()).slice(-4)).toEqual([
      'terminal',
      'browser',
      'monitoring',
      'settings',
    ]);
  });

  it('names the pinned port that is down on the Monitoring door, with the warning dot', () => {
    useAppStore.setState({
      monitorSnapshot: { listeners: [], processes: [], takenAt: 1, isPlatformSupported: true },
      monitorPinned: [{ port: 9000, description: 'Mock API' }],
    });
    mountColumn();

    const door = screen.getByRole('button', { name: 'Monitoring, pinned port :9000 is down' });
    expect(door.querySelector('[data-door-signal="warning"]')).not.toBeNull();
  });

  it('leaves the Terminal tile plain when nothing runs', () => {
    mountColumn();

    expect(screen.getByRole('button', { name: 'Terminal' })).toBeDefined();
    expect(document.querySelector('[data-door-signal]')).toBeNull();
    expect(document.querySelector('[data-tile-count]')).toBeNull();
  });

  it('draws Impact quieter than the daily doors, in the same list', () => {
    mountColumn();
    const nav = navLayer();
    const toneOf = (id: string): string =>
      nav.querySelector(`[data-column-door="${id}"]`)?.className ?? '';

    expect(toneOf('impact')).toContain('text-faint-foreground');
    expect(toneOf('workflows')).not.toContain('text-faint-foreground');
    expect(toneOf('board')).not.toContain('text-faint-foreground');
  });

  it('renders one row per door and keeps the chat plus inside its own row', () => {
    mountColumn();
    const nav = navLayer();
    const rows = Array.from(nav.querySelectorAll<HTMLElement>('[data-column-door-row]'));

    expect(rows.map((row) => row.getAttribute('data-column-door-row'))).toEqual(
      doorNames(nav).filter((id) => id !== 'terminal' && id !== 'browser' && id !== 'monitoring'),
    );
    expect(
      nav.querySelector('[data-column-door-row="chat"] [data-door-create="chat"]'),
    ).not.toBeNull();
    expect(within(nav).getAllByRole('button', { name: /^New (chat|terminal)/ })).toHaveLength(1);
  });

  it.each([
    ['board', ['board']],
    ['inbox', ['inbox']],
    ['chat', ['chat']],
    ['workflows', ['workflows']],
    ['terminal', ['terminal']],
    ['browser', ['browser']],
    ['monitoring', ['monitoring']],
    ['settings', ['settings']],
    ['new', []],
    ['impact', ['impact']],
    [null, []],
  ] as const)('marks only the %s door current', (place, expected) => {
    mountColumn({ place });

    expect(currentDoors(navLayer())).toEqual(expected);
  });

  it.each([
    ['inbox', 'info'],
    ['chat', 'primary'],
    ['terminal', 'primary'],
    ['settings', 'primary'],
  ] as const)('lights the %s door icon in its kind color while current', (place, tone) => {
    mountColumn({ place });

    const icons = Array.from(
      navLayer().querySelectorAll('[data-column-door] :is([data-nav-icon], [data-tile-icon])'),
    );
    const lit = icons.filter((icon) => icon.getAttribute('data-icon-tone') === tone);
    expect(lit).toHaveLength(1);
    expect(lit[0]?.closest('[data-column-door]')?.getAttribute('data-column-door')).toBe(place);
  });

  it('opens each door through its action, and a current door does nothing', () => {
    const doors = actions();
    mountColumn({ place: 'inbox', doors });

    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Workflows' }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }));

    expect(doors.openBoard).toHaveBeenCalledOnce();
    expect(doors.openChat).toHaveBeenCalledOnce();
    expect(doors.openWorkflows).toHaveBeenCalledOnce();
    expect(doors.openTerminalStudio).toHaveBeenCalledOnce();
    expect(doors.openSettings).toHaveBeenCalledOnce();
    expect(doors.openInbox).not.toHaveBeenCalled();
  });

  it('asks for a new session from the row under Sessions', () => {
    const onNew = vi.fn();
    window.addEventListener('goodboy:new-session', onNew);
    mountColumn();

    fireEvent.click(screen.getByRole('button', { name: 'New session' }));

    expect(onNew).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:new-session', onNew);
  });

  it('opens a new chat from the plus on the Chat door', () => {
    const doors = actions();
    mountColumn({ doors });

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }));

    expect(doors.openNewChat).toHaveBeenCalledOnce();
    expect(doors.openChat).not.toHaveBeenCalled();
  });

  it('has no full-width New session row and no create button inside a door row', () => {
    mountColumn();
    const nav = navLayer();

    expect(nav.querySelector('[data-column-door="new"]')).toBeNull();
    const doorRows = Array.from(nav.querySelectorAll('[data-column-door]'));
    for (const door of doorRows) {
      expect(door.getAttribute('aria-label')).not.toMatch(/^New /);
      expect(door.querySelector('button')).toBeNull();
    }
  });

  it('has no create row: the one plus lives on the Chat door and the tiles carry none', () => {
    mountColumn();
    const nav = navLayer();

    expect(nav.querySelector('[data-column-create]')).toBeNull();
    const chatPlus = within(nav).getByRole('button', { name: 'New chat' });
    expect(nav.querySelector('[data-column-door="chat"]')?.parentElement?.contains(chatPlus)).toBe(
      true,
    );
    expect(nav.querySelectorAll('[data-door-create]')).toHaveLength(1);
    expect(
      nav.querySelector('[data-column-tiles]')?.querySelector('[data-door-create]'),
    ).toBeNull();
  });

  it('keeps the plus on Chat visible at rest, not only on hover', () => {
    mountColumn({ place: 'board' });
    const plus = within(navLayer()).getByRole('button', { name: 'New chat' });

    expect(plus.closest('[class*="opacity-0"]')).toBeNull();
  });

  it('gives every door the same signal slot and action slot so trailing info shares an edge', () => {
    mountColumn({ place: 'board' });
    const nav = navLayer();

    for (const { id } of COLUMN_ROW_DOORS) {
      const door = nav.querySelector(`[data-column-door-row="${id}"] [data-column-door]`);
      expect(door?.querySelectorAll('[data-door-slot="signal"]')).toHaveLength(1);
      expect(door?.querySelectorAll('[data-door-slot="action"]')).toHaveLength(1);
    }
  });

  it('names running chats in the tooltip and dots only unread chats inside the signal slot', () => {
    useAppStore.setState({
      chatStreams: {
        [brandedId<ChatId>({ value: 'chat-1' })]: {
          runId: brandedId<ProviderRunId>({ value: 'run-1' }),
          messageId: brandedId<ChatMessageId>({ value: 'message-1' }),
          isStopping: false,
        },
      },
    });
    mountColumn({ place: 'board' });

    const running = screen.getByRole('button', { name: 'Chat, 1 running' });
    expect(running.querySelector('[data-door-signal]')).toBeNull();
    cleanup();
    useAppStore.setState({
      chatStreams: {},
      unreadChatIds: [brandedId<ChatId>({ value: 'chat-2' })],
    });
    mountColumn({ place: 'board' });

    const unread = screen.getByRole('button', { name: 'Chat, unread' });
    expect(
      unread.querySelector('[data-door-slot="signal"] [data-door-signal="unread"]'),
    ).not.toBeNull();
  });

  it('dots Tasks with the arrivals of the current workspace and names how many', () => {
    useAppStore.setState({ taskNewKeys: { [WORKSPACE.id]: ['linear:issue:412', 'github:pr:57'] } });
    mountColumn({ place: 'board' });

    const tasks = screen.getByRole('button', { name: 'Tasks, 2 new' });
    expect(
      tasks.querySelector('[data-door-slot="signal"] [data-door-signal="unread"]'),
    ).not.toBeNull();
    cleanup();
    useAppStore.setState({ taskNewKeys: { [WORKSPACE.id]: [] } });
    mountColumn({ place: 'board' });

    expect(
      screen.getByRole('button', { name: 'Tasks' }).querySelector('[data-door-signal]'),
    ).toBeNull();
  });

  it('puts New session first, above the doors, with no separator anywhere', () => {
    mountColumn();
    const row = within(navLayer()).getByRole('button', { name: 'New session' });
    const firstDoor = navLayer().querySelector('[data-column-door="board"]');

    expect(row.getAttribute('data-create')).toBe('session');
    expect(
      firstDoor !== null &&
        row.compareDocumentPosition(firstDoor) === Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(true);
    expect(within(navLayer()).queryAllByRole('separator')).toHaveLength(0);
  });

  it('opens the report sheet from the bug icon beside the Goodboy line', () => {
    const onReport = vi.fn();
    window.addEventListener(OPEN_REPORT_SHEET_EVENT, onReport);
    mountColumn();

    fireEvent.click(screen.getByRole('button', { name: 'Report a bug' }));

    expect(onReport).toHaveBeenCalledOnce();
    window.removeEventListener(OPEN_REPORT_SHEET_EVENT, onReport);
  });

  it('keeps only its app half before any workspace exists', () => {
    mountColumn({ scope: 'app', place: null });
    const nav = navLayer();

    expect(doorNames(nav)).toEqual(['settings']);
    expect(nav.querySelector('[data-column-sessions]')).toBeNull();
    expect(within(nav).getByTestId('goodboy-chip')).toBeDefined();
  });

  it('keeps its doors and sessions live while Settings is open, with Settings lit in the foot', () => {
    const doors = actions();
    mountColumn({ place: 'settings', doors });

    const nav = navLayer();
    expect(nav.hasAttribute('inert')).toBe(false);
    expect(document.querySelector('[data-column-layer="settings"]')).toBeNull();
    expect(nav.querySelector('[data-column-sessions]')).not.toBeNull();
    expect(nav.querySelector('[data-column-door="settings"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
    fireEvent.click(within(nav).getByRole('button', { name: /^Tasks/ }));
    expect(doors.openInbox).toHaveBeenCalledOnce();
  });

  it('leaves the Goodboy line effects to the pinned column when it peeks', () => {
    mountColumn({ isPeek: true });

    expect(screen.queryByTestId('goodboy-chip')).toBeNull();
    expect(document.querySelector('[data-goodboy-chip="column"]')).not.toBeNull();
  });
});

describe('ColumnRail', () => {
  const mountRail = ({
    place = 'board',
    scope = 'workspace',
  }: {
    readonly place?: ColumnPlace;
    readonly scope?: 'workspace' | 'app';
  } = {}) => render(<ColumnRail scope={scope} place={place} actions={actions()} />);

  it('shows no running dot and no number on the collapsed Terminal door, the count in its label', () => {
    useAppStore.setState({
      terminalTabs: {
        [WORKSPACE.id]: [
          {
            id: brandedId<TerminalTabId>({ value: 'tab-1' }),
            owner: { kind: 'workspace', workspaceId: WORKSPACE.id },
            title: 'dev',
            cwd: null,
            status: 'running',
            createdAt: 1,
          },
        ],
      },
    });
    mountRail();

    const terminal = screen.getByRole('button', { name: 'Terminal, 1 running' });
    expect(terminal.querySelector('[data-door-signal]')).toBeNull();
    expect(terminal.textContent).toBe('');
  });

  it('keeps the collapsed doors plain when nothing runs', () => {
    mountRail();

    expect(screen.getByRole('button', { name: 'Terminal' })).toBeDefined();
    expect(document.querySelector('[data-door-signal]')).toBeNull();
  });

  it('keeps every door as an icon at 44px: New, the eight doors, then Settings, the bug and the mark', () => {
    const { container } = mountRail();
    const rail = container.querySelector('[data-column-rail]') as HTMLElement;

    expect(rail.style.width).toBe(`${COLLAPSED_RAIL_WIDTH}px`);
    expect(within(rail).queryByRole('button', { name: /^Show sidebar/ })).toBeNull();
    expect(doorNames(rail)).toEqual([
      'new',
      'board',
      'inbox',
      'workflows',
      'chat',
      'impact',
      'terminal',
      'browser',
      'monitoring',
      'settings',
    ]);
    expect(within(rail).getByRole('button', { name: 'Report a bug' })).toBeDefined();
    expect(rail.querySelector('[data-goodboy-chip="rail"]')).not.toBeNull();
  });

  it.each([
    ['board', ['board']],
    ['chat', ['chat']],
    ['settings', ['settings']],
    ['new', ['new']],
    [null, []],
  ] as const)('marks only the %s door current on the rail too', (place, expected) => {
    const { container } = mountRail({ place });

    expect(currentDoors(container)).toEqual(expected);
  });

  it('lights the Goodboy mark while Help is open and lights no door', () => {
    const { container } = mountRail({ place: 'help' });

    expect(
      container.querySelector('[data-goodboy-chip="rail"]')?.getAttribute('aria-current'),
    ).toBe('page');
    expect(currentDoors(container)).toEqual([]);
  });

  it('keeps Settings, the bug and the mark with no workspace', () => {
    const { container } = mountRail({ scope: 'app', place: null });

    expect(doorNames(container)).toEqual(['settings']);
    expect(screen.getByRole('button', { name: 'Report a bug' })).toBeDefined();
  });
});
