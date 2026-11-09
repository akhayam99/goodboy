// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { brandedId } from '../../../../features/history/testing/brandedId';
import type { TerminalTabId } from '../../../../shared/types/terminal';
import { ColumnRail } from '../ColumnRail';
import { SideColumn } from '../index';
import type { ColumnActions } from '../columnDoors';
import type { ColumnPlace } from '../columnPlace';

const WORKSPACE = aWorkspace({ name: 'Harborline' });
const CHECKOUT = aSession({ workspaceId: WORKSPACE.id, goal: 'Show tax in the checkout total' });
const ROUNDING = aSession({ workspaceId: WORKSPACE.id, goal: 'Fix the rounding drift' });
const ELSEWHERE = aSession({ goal: 'Watch the notify-relay queue' });

type TabParams = {
  readonly id: string;
};

const tabOf = ({ id }: TabParams): BrowserTab => ({
  id,
  sessionId: null,
  projectId: null,
  url: `https://${id}.harborline.dev`,
  title: id,
  position: 0,
  createdAt: 1,
  updatedAt: 1,
});

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
  openShortcuts: vi.fn(),
});

type MountParams = {
  readonly place?: ColumnPlace;
  readonly doors?: ColumnActions;
  readonly onNavigate?: () => void;
};

const mountColumn = ({ place = 'board', doors = actions(), onNavigate }: MountParams = {}) =>
  render(
    <SideColumn
      scope="workspace"
      workspaceId={WORKSPACE.id}
      currentSessionId={null}
      place={place}
      actions={doors}
      {...(onNavigate !== undefined && { onNavigate })}
    />,
  );

const tiles = (): HTMLElement => {
  const group = document.querySelector<HTMLElement>('[data-column-tiles]');
  if (group === null) {
    throw new Error('the column has no tool tiles');
  }
  return group;
};

type TileParams = {
  readonly id: string;
};

const tileOf = ({ id }: TileParams): HTMLElement => {
  const tile = tiles().querySelector<HTMLElement>(`[data-column-tile="${id}"]`);
  if (tile === null) {
    throw new Error(`no tile for ${id}`);
  }
  return tile;
};

type TerminalParams = {
  readonly id: string;
};

const aliveTerminal = ({ id }: TerminalParams) => ({
  id: brandedId<TerminalTabId>({ value: id }),
  owner: { kind: 'workspace' as const, workspaceId: WORKSPACE.id },
  title: 'dev',
  cwd: null,
  status: 'running' as const,
  createdAt: 1,
});

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

describe('the tool tiles', () => {
  it('draws Terminal, Browser and Monitoring as one labelled group of tiles with the word under the icon', () => {
    mountColumn();

    expect(tiles().getAttribute('role')).toBe('group');
    expect(tiles().getAttribute('aria-label')).toBe('Tools');
    expect(
      Array.from(tiles().querySelectorAll('[data-column-tile]')).map((tile) =>
        tile.getAttribute('data-column-tile'),
      ),
    ).toEqual(['terminal', 'browser', 'monitoring']);
    expect(tileOf({ id: 'terminal' }).textContent).toBe('Terminal');
    expect(tileOf({ id: 'browser' }).textContent).toBe('Browser');
    expect(tileOf({ id: 'monitoring' }).textContent).toBe('Monitoring');
    expect(tileOf({ id: 'browser' }).querySelector('svg')).not.toBeNull();
  });

  it('counts the browser tabs of the workspace sessions on the Browser tile, and nothing when none is listed', () => {
    mountColumn();
    expect(tileOf({ id: 'browser' }).getAttribute('aria-label')).toBe('Browser');
    expect(tileOf({ id: 'browser' }).querySelector('[data-tile-count]')).toBeNull();
    cleanup();

    useAppStore.setState({
      sessions: [CHECKOUT, ROUNDING, ELSEWHERE],
      browserSessionTabs: {
        [CHECKOUT.id]: [tabOf({ id: 'tab-1' }), tabOf({ id: 'tab-2' })],
        [ROUNDING.id]: [tabOf({ id: 'tab-3' })],
        [ELSEWHERE.id]: [tabOf({ id: 'tab-4' })],
      },
    });
    mountColumn();

    expect(tileOf({ id: 'browser' }).getAttribute('aria-label')).toBe('Browser, 3 tabs');
    expect(tileOf({ id: 'browser' }).querySelector('[data-tile-count]')?.textContent).toBe('3');
  });

  it('counts live terminals in the name and on the tile, and nothing when none run', () => {
    mountColumn();
    expect(tileOf({ id: 'terminal' }).getAttribute('aria-label')).toBe('Terminal');
    expect(tileOf({ id: 'terminal' }).querySelector('[data-tile-count]')).toBeNull();
    cleanup();

    useAppStore.setState({
      terminalTabs: {
        [WORKSPACE.id]: [aliveTerminal({ id: 'tab-1' }), aliveTerminal({ id: 'tab-2' })],
      },
    });
    mountColumn();

    expect(tileOf({ id: 'terminal' }).getAttribute('aria-label')).toBe('Terminal, 2 running');
    expect(tileOf({ id: 'terminal' }).querySelector('[data-tile-count]')?.textContent).toBe('2');
  });

  it('caps a long count the way the rows do', () => {
    useAppStore.setState({
      terminalTabs: {
        [WORKSPACE.id]: Array.from({ length: 12 }, (_, index) =>
          aliveTerminal({ id: `tab-${index}` }),
        ),
      },
    });
    mountColumn();

    expect(tileOf({ id: 'terminal' }).querySelector('[data-tile-count]')?.textContent).toBe('9+');
    expect(tileOf({ id: 'terminal' }).getAttribute('aria-label')).toBe('Terminal, 12 running');
  });

  it('swaps the Monitoring count for a warning dot when a pinned port is down', () => {
    useAppStore.setState({
      monitorSnapshot: { listeners: [], processes: [], takenAt: 1, isPlatformSupported: true },
      monitorPinned: [{ port: 9000, description: 'Mock API' }],
    });
    mountColumn();

    const tile = tileOf({ id: 'monitoring' });
    expect(tile.getAttribute('aria-label')).toBe('Monitoring, pinned port :9000 is down');
    expect(tile.querySelector('[data-door-signal="warning"]')).not.toBeNull();
    expect(tile.querySelector('[data-tile-count]')).toBeNull();
  });

  it('opens the tool page of the tile and tells the shell to close a peek', () => {
    const doors = actions();
    const onNavigate = vi.fn();
    mountColumn({ doors, onNavigate });

    fireEvent.click(screen.getByRole('button', { name: 'Terminal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Browser' }));
    fireEvent.click(screen.getByRole('button', { name: 'Monitoring' }));

    expect(doors.openTerminalStudio).toHaveBeenCalledOnce();
    expect(doors.openBrowserStudio).toHaveBeenCalledOnce();
    expect(doors.openMonitoring).toHaveBeenCalledOnce();
    expect(onNavigate).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['terminal', 'monitoring'],
    ['browser', 'terminal'],
    ['monitoring', 'browser'],
  ] as const)(
    'presses the %s tile only on its own page and does nothing when pressed',
    (place, other) => {
      const doors = actions();
      mountColumn({ place, doors });

      expect(tileOf({ id: place }).getAttribute('aria-current')).toBe('page');
      expect(tileOf({ id: other }).hasAttribute('aria-current')).toBe(false);

      fireEvent.click(tileOf({ id: place }));

      expect(doors.openTerminalStudio).not.toHaveBeenCalled();
      expect(doors.openBrowserStudio).not.toHaveBeenCalled();
      expect(doors.openMonitoring).not.toHaveBeenCalled();
    },
  );

  it('leaves both tiles unpressed on a place that is not a tool', () => {
    mountColumn({ place: 'board' });

    expect(tiles().querySelector('[aria-current="page"]')).toBeNull();
  });

  it('is a real button in the tab order that takes keyboard focus', () => {
    mountColumn();
    const tile = tileOf({ id: 'terminal' });

    expect(tile.tagName).toBe('BUTTON');
    expect(tile.getAttribute('type')).toBe('button');
    expect(tile.hasAttribute('tabindex')).toBe(false);
    tile.focus();
    expect(document.activeElement).toBe(tile);
  });

  it('keeps the doors as icons with the same names on the folded column', () => {
    useAppStore.setState({
      terminalTabs: { [WORKSPACE.id]: [aliveTerminal({ id: 'tab-1' })] },
      sessions: [CHECKOUT],
      browserSessionTabs: { [CHECKOUT.id]: [tabOf({ id: 'tab-1' })] },
    });
    render(
      <ColumnRail
        scope="workspace"
        workspaceId={WORKSPACE.id}
        place="browser"
        actions={actions()}
      />,
    );

    expect(document.querySelector('[data-column-tiles]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Terminal, 1 running' }).textContent).toBe('');
    const browser = screen.getByRole('button', { name: 'Browser, 1 tab' });
    expect(browser.textContent).toBe('');
    expect(browser.querySelector('svg')).not.toBeNull();
    expect(browser.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Monitoring' }).textContent).toBe('');
  });
});
