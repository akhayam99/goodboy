// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { COLLAPSED_RAIL_WIDTH } from '@goodboy/ui';
import { aWorkspace } from '@goodboy/types/testing';
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
import type { ColumnActions } from './columnDoors';
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
      isCollapsed={false}
      actions={doors}
      onToggle={vi.fn()}
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
  });
});

afterEach(cleanup);

describe('SideColumn', () => {
  it('stacks the toggle, the six doors, the sessions, then Settings and the Goodboy row', () => {
    mountColumn();
    const nav = navLayer();

    expect(within(nav).getAllByRole('button')[0]?.getAttribute('aria-label')).toMatch(
      /^Hide sidebar/,
    );
    expect(doorNames(nav)).toEqual([
      'board',
      'inbox',
      'chat',
      'workflows',
      'terminal',
      'monitoring',
      'settings',
    ]);
    expect(nav.querySelector('[data-column-sessions]')).not.toBeNull();
    const foot = nav.querySelector('[data-column-foot]') as HTMLElement;
    expect(within(foot).getByRole('button', { name: 'Settings' })).toBeDefined();
    expect(within(foot).getByTestId('goodboy-chip')).toBeDefined();
    expect(within(foot).getByRole('button', { name: 'Report a bug' })).toBeDefined();
  });

  it('names a live terminal on the Terminal row without crowding its plus', () => {
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
    expect(door.querySelector('[data-door-signal="count"]')?.textContent).toBe('1');
    expect(screen.getByRole('button', { name: 'New terminal' })).toBeDefined();
  });

  it('puts a warning on the Monitoring row when a pinned port is down', () => {
    useAppStore.setState({
      monitorSnapshot: { listeners: [], processes: [], takenAt: 1, isPlatformSupported: true },
      monitorPinned: [{ port: 9000, description: 'Mock API' }],
    });
    mountColumn();

    const door = screen.getByRole('button', { name: 'Monitoring, a pinned port is down' });
    expect(door.querySelector('[data-door-signal="warning"]')).not.toBeNull();
  });

  it('stays quiet about a pinned port before the first scan', () => {
    useAppStore.setState({ monitorPinned: [{ port: 9000, description: 'Mock API' }] });
    mountColumn();

    expect(screen.getByRole('button', { name: 'Monitoring' })).toBeDefined();
  });

  it('leaves the Terminal and Monitoring rows plain when nothing runs', () => {
    mountColumn();

    expect(screen.getByRole('button', { name: 'Terminal' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Monitoring' })).toBeDefined();
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
    ['monitoring', ['monitoring']],
    ['settings', ['settings']],
    ['new', []],
    ['impact', []],
    [null, []],
  ] as const)('marks only the %s door current', (place, expected) => {
    mountColumn({ place });

    expect(currentDoors(navLayer())).toEqual(expected);
  });

  it('opens each door through its action, and a current door does nothing', () => {
    const doors = actions();
    mountColumn({ place: 'inbox', doors });

    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Workflows' }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Monitoring' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }));

    expect(doors.openBoard).toHaveBeenCalledOnce();
    expect(doors.openChat).toHaveBeenCalledOnce();
    expect(doors.openWorkflows).toHaveBeenCalledOnce();
    expect(doors.openTerminalStudio).toHaveBeenCalledOnce();
    expect(doors.openMonitoring).toHaveBeenCalledOnce();
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

  it('puts New session first under the Sessions header, after one separator', () => {
    mountColumn();
    const sessions = navLayer().querySelector('[data-column-sessions]');
    const row = within(navLayer()).getByRole('button', { name: 'New session' });

    expect(sessions?.contains(row)).toBe(true);
    expect(row.getAttribute('data-create')).toBe('session');
    expect(within(navLayer()).getAllByRole('separator')).toHaveLength(1);
    expect(
      navLayer()
        .querySelector('[role="separator"]')
        ?.parentElement?.nextElementSibling?.contains(row),
    ).toBe(true);
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
  } = {}) =>
    render(<ColumnRail scope={scope} place={place} onToggle={vi.fn()} actions={actions()} />);

  it('shows a dot, not a number, on the collapsed Terminal and Monitoring doors', () => {
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
      monitorSnapshot: { listeners: [], processes: [], takenAt: 1, isPlatformSupported: true },
      monitorPinned: [{ port: 9000, description: 'Mock API' }],
    });
    mountRail();

    const terminal = screen.getByRole('button', { name: 'Terminal, 1 running' });
    expect(terminal.querySelector('[data-door-signal="dot"]')).not.toBeNull();
    expect(terminal.textContent).toBe('');
    const monitoring = screen.getByRole('button', { name: 'Monitoring, a pinned port is down' });
    expect(monitoring.querySelector('[data-door-signal="warning"]')).not.toBeNull();
  });

  it('keeps the collapsed doors plain when nothing runs', () => {
    mountRail();

    expect(screen.getByRole('button', { name: 'Terminal' })).toBeDefined();
    expect(document.querySelector('[data-door-signal]')).toBeNull();
  });

  it('keeps every door at 44px: toggle, New, the six doors, then Settings, the bug and the mark', () => {
    const { container } = mountRail();
    const rail = container.querySelector('[data-column-rail]') as HTMLElement;

    expect(rail.style.width).toBe(`${COLLAPSED_RAIL_WIDTH}px`);
    expect(within(rail).getAllByRole('button')[0]?.getAttribute('aria-label')).toMatch(
      /^Show sidebar/,
    );
    expect(doorNames(rail)).toEqual([
      'new',
      'board',
      'inbox',
      'chat',
      'workflows',
      'terminal',
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

  it('keeps Settings, the bug and the mark with no workspace', () => {
    const { container } = mountRail({ scope: 'app', place: null });

    expect(doorNames(container)).toEqual(['settings']);
    expect(screen.getByRole('button', { name: 'Report a bug' })).toBeDefined();
  });
});
