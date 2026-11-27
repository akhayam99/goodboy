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
import { brandId, type SessionId } from '@goodboy/types';
import { SHELL_RAIL_FOOT_PX } from '@goodboy/ui';
import { APP_VERSION } from '../../../shared/lib/appVersion';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import {
  harborline,
  seedColumn,
  sessionOf,
} from '../../../features/workspace/testing/sessionColumn';
import { shellArrangement } from '../../shellArrangement';
import { EMPTY_SESSION_DRAFT } from '../../../store/slices/sessionDraft/state';
import type { ColumnPlace } from '../../../shared/navigation/columnPlace';
import type { ColumnActions } from './columnDoors';
import { ShellLeft } from '.';

let useAppStore: StoryStore;

const ARRANGEMENT = shellArrangement({ hasWorkspace: true });

const open = sessionOf({ goal: 'Fix webhook retries', lastOpenedAt: '2026-10-06T09:00:00.000Z' });

const OPEN_ID = brandId<SessionId>({ value: open.id });

const actionsOf = (): ColumnActions => ({
  openHome: vi.fn(),
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
  it('draws the workspace, New, the seven places with Impact last, then Settings, at 64px with a word under each', () => {
    mount({});

    expect(rail().style.width).toBe('64px');
    expect(wordsOf()).toEqual([
      'Harborline',
      'New',
      'Home',
      'Board',
      'Tasks',
      'Workflows',
      'Chat',
      'Connect',
      'Impact',
      'Settings',
      'Report',
    ]);
    expect(within(rail()).queryByRole('button', { name: /Monitoring/ })).toBeNull();
    within(rail()).getByRole('button', { name: 'Connections' });
  });

  it('opens the workspace popover from the mark at the top of the rail and from its chord', () => {
    mount({});
    const mark = within(rail()).getByRole('button', { name: 'Switch workspace: Harborline' });

    expect(rail().querySelector('[data-shell-rail-item]')).toBe(mark);
    expect(mark.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(mark);
    expect(mark.getAttribute('aria-expanded')).toBe('true');
    screen.getByRole('dialog', { name: 'Switch or open a workspace' });
    fireEvent.click(mark);
    expect(mark.getAttribute('aria-expanded')).toBe('false');

    act(() => {
      window.dispatchEvent(new CustomEvent('goodboy:open-workspace-switcher'));
    });
    expect(mark.getAttribute('aria-expanded')).toBe('true');
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

  it('keeps the Board lit while a session is open, and a click on it goes to the Board', () => {
    const actions = mount({ currentSessionId: OPEN_ID });

    expect(current()).toEqual(['board']);
    fireEvent.click(within(rail()).getByRole('button', { name: 'Board' }));
    expect(actions.openBoard).toHaveBeenCalledOnce();
  });

  it('does nothing on a click of the Board while the Board is open', () => {
    const actions = mount({});

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

  it('ends the rail with Settings, Report and the signature, in that order', () => {
    mount({});

    const foot = Array.from(
      rail().querySelectorAll('[data-shell-rail-item], [data-rail-signature]'),
      (item) => item.getAttribute('data-shell-rail-item') ?? 'signature',
    ).slice(-3);
    expect(foot).toEqual(['settings', 'report', 'signature']);
  });

  it("draws the signature as a 32px brand tile in a button named What's new, with no word", () => {
    mount({});
    const signature = within(rail()).getByRole('button', { name: "What's new" });
    const tile = signature.querySelector<HTMLElement>('[data-brand-tile]');

    expect(signature.hasAttribute('data-rail-signature')).toBe(true);
    expect(tile?.style.width).toBe('32px');
    expect(tile?.style.height).toBe('32px');
    expect(signature.textContent).toBe('');
    expect(wordsOf()).not.toContain("What's new");
    expect(signature.querySelector('[data-unseen-release]')).toBeNull();
  });

  it('closes the rail with the signature, its foot one rail edge above the content sheet bottom', () => {
    mount({});
    const signature = rail().querySelector<HTMLElement>('[data-rail-signature]');

    expect(rail().lastElementChild).toBe(signature);
    expect(rail().style.paddingBottom).toBe(`${SHELL_RAIL_FOOT_PX}px`);
  });

  it('reaches the signature with the arrow keys, after the last foot item', () => {
    mount({});
    const report = within(rail()).getByRole('button', { name: 'Report a bug' });
    report.focus();

    fireEvent.keyDown(report, { key: 'ArrowDown' });

    expect(document.activeElement).toBe(rail().querySelector('[data-rail-signature]'));
  });

  it("opens What's new from the signature and nothing else", () => {
    const actions = mount({});

    fireEvent.click(within(rail()).getByRole('button', { name: "What's new" }));

    expect(actions.openChangelog).toHaveBeenCalledOnce();
    Object.entries(actions)
      .filter(([key]) => key !== 'openChangelog')
      .forEach(([, action]) => expect(action).not.toHaveBeenCalled());
  });

  it('puts a dot on the signature while the installed release has unread notes, and drops it once read', () => {
    mount({});
    act(() => {
      useAppStore.setState({ changelogSeenHydrated: true, changelogSeenVersion: '0.0.1' });
    });

    const signature = within(rail()).getByRole('button', {
      name: "What's new, new release notes",
    });
    expect(signature.querySelector('[data-unseen-release]')).not.toBeNull();

    act(() => {
      useAppStore.setState({ changelogSeenVersion: APP_VERSION });
    });

    expect(within(rail()).getByRole('button', { name: "What's new" })).toBe(signature);
    expect(signature.querySelector('[data-unseen-release]')).toBeNull();
  });

  it('shows no dot before the seen release is read, or on a fresh install', () => {
    mount({});
    act(() => {
      useAppStore.setState({ changelogSeenHydrated: false, changelogSeenVersion: '0.0.1' });
    });
    expect(rail().querySelector('[data-unseen-release]')).toBeNull();

    act(() => {
      useAppStore.setState({ changelogSeenHydrated: true, changelogSeenVersion: null });
    });
    expect(rail().querySelector('[data-unseen-release]')).toBeNull();
  });

  it('opens the report sheet from Report, which names its draft once one is saved', () => {
    mount({});
    const onOpen = vi.fn();
    window.addEventListener('goodboy:open-report-sheet', onOpen);

    fireEvent.click(within(rail()).getByRole('button', { name: 'Report a bug' }));
    act(() => {
      useAppStore.setState({
        bugReportDraft: { ...useAppStore.getState().bugReportDraft, title: 'Retries loop' },
      });
    });

    window.removeEventListener('goodboy:open-report-sheet', onOpen);
    expect(onOpen).toHaveBeenCalledOnce();
    within(rail()).getByRole('button', { name: 'Report a bug, draft saved' });
  });

  it('puts the update mark above the signature while an update waits, and keeps the signature', () => {
    mount({});
    act(() => {
      useAppStore.setState({ updaterStatus: 'available', updateVersion: '0.40.1' });
    });

    const foot = Array.from(
      rail().querySelectorAll('[data-shell-rail-item], [data-rail-signature]'),
      (item) => item.getAttribute('data-shell-rail-item') ?? 'signature',
    ).slice(-4);
    expect(foot).toEqual(['settings', 'report', 'update', 'signature']);
    expect(wordsOf().slice(-3)).toEqual(['Settings', 'Report', 'Update']);
  });

  it('takes the update mark away once the update is gone and leaves the signature', () => {
    mount({});
    act(() => {
      useAppStore.setState({ updaterStatus: 'available', updateVersion: '0.40.1' });
    });
    act(() => {
      useAppStore.setState({ updaterStatus: 'uptodate', updateVersion: null });
    });

    expect(rail().querySelector('[data-shell-rail-item="update"]')).toBeNull();
    expect(rail().querySelector('[data-rail-signature]')).not.toBeNull();
  });

  it('shows only the foot outside a workspace', () => {
    seedColumn({ store: useAppStore, sessions: [] });
    render(
      <ShellLeft
        arrangement={shellArrangement({ hasWorkspace: false })}
        workspaceId={null}
        actions={actionsOf()}
      />,
    );

    expect(wordsOf()).toEqual(['Settings', 'Report']);
  });
});

describe('the marks the places rail carries', () => {
  const writeDraft = () =>
    act(() => {
      useAppStore.setState({
        sessionDrafts: {
          [harborline.id]: { ...EMPTY_SESSION_DRAFT, workflowGoal: 'Add rate limits' },
        },
      });
    });

  it('dots New and names the draft while one waits on another page', () => {
    mount({});
    within(rail()).getByRole('button', { name: 'New session' });

    writeDraft();

    within(rail()).getByRole('button', { name: 'New session, draft in progress' });
  });

  it('drops the draft dot while the draft itself is open', () => {
    mount({ placeOverride: 'new' });

    writeDraft();

    within(rail()).getByRole('button', { name: 'New session' });
    expect(current()).toEqual(['new']);
  });

  it('dots Tasks with the arrivals of the workspace and names how many', () => {
    useAppStore.setState({
      taskNewKeys: { [harborline.id]: ['linear:issue:412', 'github:pr:57'] },
    });
    mount({});

    within(rail()).getByRole('button', { name: 'Tasks, 2 new' });
  });

  it('lights no place while Help is open, the signature included', () => {
    mount({ placeOverride: 'help' });

    expect(rail().querySelectorAll('[aria-current]')).toHaveLength(0);
  });
});
