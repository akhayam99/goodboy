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
import { COLUMN_DOORS, type ColumnActions } from './columnDoors';
import type { ColumnPlace } from './columnPlace';

const WORKSPACE = aWorkspace({ name: 'Harborline' });

let useAppStore: StoryStore;

const actions = (): ColumnActions => ({
  openBoard: vi.fn(),
  openInbox: vi.fn(),
  openChat: vi.fn(),
  openWorkflows: vi.fn(),
  openTerminalStudio: vi.fn(),
  openNewChat: vi.fn(),
  openNewTerminal: vi.fn(),
  openMonitoring: vi.fn(),
  openSettings: vi.fn(),
  openChangelog: vi.fn(),
  openGuide: vi.fn(),
  openShortcuts: vi.fn(),
});

type MountParams = {
  readonly place?: ColumnPlace;
  readonly scope?: 'workspace' | 'app';
  readonly doors?: ColumnActions;
  readonly settingsSlotRef?: (node: HTMLDivElement | null) => void;
  readonly isPeek?: boolean;
};

const mountColumn = ({
  place = 'board',
  scope = 'workspace',
  doors = actions(),
  settingsSlotRef,
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
      {...(settingsSlotRef !== undefined && { settingsSlotRef })}
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
  it('stacks New session, the five doors, the sessions, then Settings and the Goodboy row, the toggle left to the top bar', () => {
    mountColumn();
    const nav = navLayer();

    expect(within(nav).queryByRole('button', { name: /^Hide sidebar/ })).toBeNull();
    expect(within(nav).getAllByRole('button')[0]?.getAttribute('aria-label')).toMatch(
      /^New session/,
    );
    expect(doorNames(nav)).toEqual(['board', 'inbox', 'chat', 'workflows', 'terminal', 'settings']);
    expect(nav.querySelector('[data-column-sessions]')).not.toBeNull();
    const foot = nav.querySelector('[data-column-foot]') as HTMLElement;
    expect(within(foot).getByRole('button', { name: 'Settings' })).toBeDefined();
    expect(within(foot).getByTestId('goodboy-chip')).toBeDefined();
    expect(within(foot).getByRole('button', { name: 'Report a bug' })).toBeDefined();
  });

  it('names a live terminal in the Terminal row tooltip, no running dot beside the plus', () => {
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
    expect(door.querySelector('[data-door-slot="signal"]')?.textContent).toBe('');
    expect(screen.getByRole('button', { name: 'New terminal' })).toBeDefined();
  });

  it('has no Monitoring door: Monitoring lives in the top bar', () => {
    mountColumn();

    expect(screen.queryByRole('button', { name: /^Monitoring/ })).toBeNull();
  });

  it('leaves the Terminal row plain when nothing runs', () => {
    mountColumn();

    expect(screen.getByRole('button', { name: 'Terminal' })).toBeDefined();
    expect(document.querySelector('[data-door-signal]')).toBeNull();
  });

  it('renders one row per door and keeps each plus inside its own row', () => {
    mountColumn();
    const nav = navLayer();
    const rows = Array.from(nav.querySelectorAll<HTMLElement>('[data-column-door-row]'));
    const rowOf = ({ id }: { readonly id: string }): HTMLElement => {
      const row = nav.querySelector<HTMLElement>(`[data-column-door-row="${id}"]`);
      if (row === null) {
        throw new Error(`no row for ${id}`);
      }
      return row;
    };

    expect(rows.map((row) => row.getAttribute('data-column-door-row'))).toEqual(doorNames(nav));
    expect(within(rowOf({ id: 'chat' })).getByRole('button', { name: /^New chat/ })).toBeDefined();
    expect(
      within(rowOf({ id: 'terminal' })).getByRole('button', { name: /^New terminal/ }),
    ).toBeDefined();
    expect(within(nav).getAllByRole('button', { name: /^New (chat|terminal)/ })).toHaveLength(2);
  });

  it.each([
    ['board', ['board']],
    ['inbox', ['inbox']],
    ['chat', ['chat']],
    ['workflows', ['workflows']],
    ['terminal', ['terminal']],
    ['monitoring', []],
    ['settings', ['settings']],
    ['new', []],
    ['impact', []],
    [null, []],
  ] as const)('marks only the %s door current', (place, expected) => {
    mountColumn({ place });

    expect(currentDoors(navLayer())).toEqual(expected);
  });

  it.each([
    ['inbox', 'text-info'],
    ['chat', 'text-primary'],
    ['terminal', 'text-primary'],
    ['settings', 'text-primary'],
  ] as const)('lights the %s door icon in its kind color while current', (place, iconClass) => {
    mountColumn({ place });

    const icons = Array.from(navLayer().querySelectorAll('[data-column-door] [data-nav-icon]'));
    const lit = icons.filter((icon) => (icon.getAttribute('class') ?? '').includes(iconClass));
    expect(lit).toHaveLength(1);
    expect(lit[0]?.closest('[data-column-door]')?.getAttribute('data-column-door')).toBe(place);
  });

  it('opens each door through its action, and a current door does nothing', () => {
    const doors = actions();
    mountColumn({ place: 'inbox', doors });

    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
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

  it('opens a new chat and a new terminal from the plus on their own door', () => {
    const doors = actions();
    mountColumn({ doors });

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'New terminal' }));

    expect(doors.openNewChat).toHaveBeenCalledOnce();
    expect(doors.openNewTerminal).toHaveBeenCalledOnce();
    expect(doors.openChat).not.toHaveBeenCalled();
    expect(doors.openTerminalStudio).not.toHaveBeenCalled();
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

  it('has no create row: the plus buttons live on the Chat and Terminal doors', () => {
    mountColumn();
    const nav = navLayer();

    expect(nav.querySelector('[data-column-create]')).toBeNull();
    const chatPlus = within(nav).getByRole('button', { name: 'New chat' });
    const terminalPlus = within(nav).getByRole('button', { name: 'New terminal' });
    expect(nav.querySelector('[data-column-door="chat"]')?.parentElement?.contains(chatPlus)).toBe(
      true,
    );
    expect(
      nav.querySelector('[data-column-door="terminal"]')?.parentElement?.contains(terminalPlus),
    ).toBe(true);
    expect(nav.querySelectorAll('[data-door-create]')).toHaveLength(2);
  });

  it('keeps the plus on Chat and Terminal visible at rest, not only on hover', () => {
    mountColumn({ place: 'board' });
    const nav = navLayer();

    for (const name of ['New chat', 'New terminal']) {
      const plus = within(nav).getByRole('button', { name });
      expect(plus.closest('[class*="opacity-0"]')).toBeNull();
    }
  });

  it('gives every door the same signal slot and action slot so trailing info shares an edge', () => {
    mountColumn({ place: 'board' });
    const nav = navLayer();

    for (const { id } of COLUMN_DOORS) {
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

  it('opens the report sheet from the bug button beside the Goodboy row', () => {
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

  it('swaps its content for the settings layer while Settings is open', () => {
    const slots: Array<HTMLDivElement | null> = [];
    mountColumn({ place: 'settings', settingsSlotRef: (node) => slots.push(node) });

    const settings = document.querySelector('[data-column-layer="settings"]') as HTMLElement;
    expect(slots.at(-1)).toBe(settings);
    expect(settings.hasAttribute('inert')).toBe(false);
    expect(navLayer().hasAttribute('inert')).toBe(true);
  });

  it('keeps the doors live under any other place, with the settings layer inert', () => {
    mountColumn({ place: 'inbox', settingsSlotRef: () => undefined });

    expect(document.querySelector('[data-column-layer="settings"]')?.hasAttribute('inert')).toBe(
      true,
    );
    expect(navLayer().hasAttribute('inert')).toBe(false);
  });

  it('leaves the Goodboy menu effects to the pinned column when it peeks', () => {
    mountColumn({ isPeek: true });

    expect(screen.queryByTestId('goodboy-chip')).toBeNull();
    expect(document.querySelector('[data-goodboy-chip="column"]')).not.toBeNull();
    expect(document.querySelector('[data-column-layer="settings"]')).toBeNull();
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

  it('keeps every door at 44px: New, the five doors, then Settings, the bug and the mark', () => {
    const { container } = mountRail();
    const rail = container.querySelector('[data-column-rail]') as HTMLElement;

    expect(rail.style.width).toBe(`${COLLAPSED_RAIL_WIDTH}px`);
    expect(within(rail).queryByRole('button', { name: /^Show sidebar/ })).toBeNull();
    expect(doorNames(rail)).toEqual([
      'new',
      'board',
      'inbox',
      'chat',
      'workflows',
      'terminal',
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

  it('keeps Settings, the bug and the mark with no workspace', () => {
    const { container } = mountRail({ scope: 'app', place: null });

    expect(doorNames(container)).toEqual(['settings']);
    expect(screen.getByRole('button', { name: 'Report a bug' })).toBeDefined();
  });
});
