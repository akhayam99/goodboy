// @vitest-environment happy-dom

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

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
  harborline,
  seedColumn,
  sessionOf,
} from '../../../../features/workspace/testing/sessionColumn';
import { shellArrangement } from '../../../shellArrangement';
import type { ColumnPlace } from '../../../../shared/navigation/columnPlace';
import type { ColumnActions } from '../columnDoors';
import { ShellLeft } from '.';

let useAppStore: StoryStore;

const ARRANGEMENT = shellArrangement({ hasWorkspace: true, isSidebarCollapsed: false });

const open = sessionOf({ goal: 'Fix webhook retries', lastOpenedAt: '2026-10-06T09:00:00.000Z' });

const OPEN_ID = brandId<SessionId>({ value: open.id });

const actionsOf = (): ColumnActions => ({
  openBoard: vi.fn(),
  openInbox: vi.fn(),
  openChat: vi.fn(),
  openWorkflows: vi.fn(),
  openNewChat: vi.fn(),
  openConnections: vi.fn(),
  openMonitoring: vi.fn(),
  openImpact: vi.fn(),
  openSettings: vi.fn(),
  openChangelog: vi.fn(),
  openGuide: vi.fn(),
});

type MountParams = {
  readonly actions?: ColumnActions;
  readonly currentSessionId?: SessionId | null;
  readonly placeOverride?: ColumnPlace;
};

const mount = ({ actions = actionsOf(), currentSessionId = null, placeOverride }: MountParams) => {
  seedColumn({ store: useAppStore, sessions: [open], currentSessionId });
  render(
    <ShellLeft
      arrangement={ARRANGEMENT}
      workspaceId={harborline.id}
      actions={actions}
      {...(placeOverride !== undefined && { placeOverride })}
    />,
  );
  return actions;
};

const rail = () => screen.getByRole('navigation', { name: 'Places' });

const wordsOf = (): ReadonlyArray<string> =>
  Array.from(rail().querySelectorAll('[data-slot="rail-word"]'), (word) => word.textContent ?? '');

const current = (): ReadonlyArray<string> =>
  Array.from(
    rail().querySelectorAll('[aria-current="page"]'),
    (item) => item.getAttribute('data-shell-rail-item') ?? '',
  );

type WidthParams = {
  readonly width: number;
};

const stubWindowWidth = ({ width }: WidthParams) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: width <= Number.parseFloat(query.replace('(max-width:', '')),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubWindowWidth({ width: 1440 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the places rail', () => {
  it('draws New, the six places with Impact last, then Settings, at 64px with a word under each', () => {
    mount({});

    expect(rail().style.width).toBe('64px');
    expect(wordsOf()).toEqual([
      'New',
      'Board',
      'Tasks',
      'Workflows',
      'Chat',
      'Connect',
      'Impact',
      'Settings',
    ]);
    expect(within(rail()).queryByRole('button', { name: /Monitoring/ })).toBeNull();
    within(rail()).getByRole('button', { name: 'Connections' });
  });

  it('drops to 44px icons under a 1100px window, every place still named', () => {
    stubWindowWidth({ width: 1024 });
    mount({});

    expect(rail().style.width).toBe('44px');
    expect(wordsOf()).toEqual([]);
    within(rail()).getByRole('button', { name: 'Connections' });
    within(rail()).getByRole('button', { name: 'Impact' });
  });

  it('opens every place through its own action, once', () => {
    const actions = mount({ placeOverride: 'settings' });
    const routes: ReadonlyArray<readonly [string, keyof ColumnActions]> = [
      ['Board', 'openBoard'],
      ['Tasks', 'openInbox'],
      ['Workflows', 'openWorkflows'],
      ['Chat', 'openChat'],
      ['Connections', 'openConnections'],
      ['Impact', 'openImpact'],
    ];

    routes.forEach(([name]) => fireEvent.click(within(rail()).getByRole('button', { name })));

    routes.forEach(([, action]) => expect(actions[action]).toHaveBeenCalledOnce());
    expect(actions.openMonitoring).not.toHaveBeenCalled();
  });

  it('asks for a new session from New and opens Settings from the foot', () => {
    const actions = mount({});
    const onNew = vi.fn();
    window.addEventListener('goodboy:new-session', onNew);

    fireEvent.click(within(rail()).getByRole('button', { name: 'New session' }));
    fireEvent.click(within(rail()).getByRole('button', { name: 'Settings' }));

    window.removeEventListener('goodboy:new-session', onNew);
    expect(onNew).toHaveBeenCalledOnce();
    expect(actions.openSettings).toHaveBeenCalledOnce();
  });

  it('keeps the Board lit while a session is open, since the session is its child', () => {
    const actions = mount({ currentSessionId: OPEN_ID });

    expect(current()).toEqual(['board']);
    fireEvent.click(within(rail()).getByRole('button', { name: 'Board' }));
    expect(actions.openBoard).not.toHaveBeenCalled();
  });

  it('moves the light to the place a page opens over the session', () => {
    mount({ currentSessionId: OPEN_ID, placeOverride: 'chat' });

    expect(current()).toEqual(['chat']);
  });

  it('follows the session out: closing it leaves the Board lit', () => {
    mount({ currentSessionId: OPEN_ID });

    act(() => {
      useAppStore.setState({ currentSessionId: null });
    });

    expect(current()).toEqual(['board']);
  });

  it('shows only the foot outside a workspace', () => {
    seedColumn({ store: useAppStore, sessions: [] });
    render(
      <ShellLeft
        arrangement={shellArrangement({ hasWorkspace: false, isSidebarCollapsed: false })}
        workspaceId={null}
        actions={actionsOf()}
      />,
    );

    expect(wordsOf()).toEqual(['Settings']);
  });
});
