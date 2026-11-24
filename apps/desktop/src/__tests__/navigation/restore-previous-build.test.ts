// @vitest-environment happy-dom
const h = vi.hoisted(() => ({ settings: new Map<string, string>() }));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../test/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../test/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../test/storyHarness')).dbModuleMock({
    setSetting: vi.fn(async (_db: unknown, key: string, value: string) => {
      h.settings.set(key, value);
    }),
    deleteSetting: vi.fn(async (_db: unknown, key: string) => {
      h.settings.delete(key);
    }),
    listSettingsWithPrefix: vi.fn(async (_db: unknown, prefix: string) =>
      [...h.settings.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({ key, value })),
    ),
  }),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../test/storyHarness')).dbLibModuleMock(),
);

import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import { createElement } from 'react';
import { AppShell } from '@goodboy/ui';
import { brandId, type AgentId, type SessionId, type WorkspaceId } from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../test/storyHarness';
import { DRAWER_KINDS } from '../../store/slices/drawer/drawerKinds';
import { UNSAVED_DRAWER_KINDS } from '../../store/slices/drawer/unsavedDrawerKinds';
import { IPHONE_SETTINGS_PLACE } from '../../features/settings/iphoneSettingsPlace';
import { listWindowLayouts } from '../../features/workspace/windowLayout';
import { useLevelCardFold } from '../../app/components/SessionRail/SessionLevel/useLevelCardFold';
import { useRailTreeOpen } from '../../app/components/SessionRail/SessionLevel/useRailTreeOpen';
import { PREVIOUS_BUILD_BLOBS } from './previousBuildBlobs';
import { READER_DRAWER_STORAGE_KEY, RIGHT_DRAWER_STORAGE_KEY } from '@goodboy/ui';
import { selectGridTool } from '../../store/slices/drawer/selectGridTool';
import { watchSessionDockGrid } from '../../features/workspace/hooks/useSessionDockGrid/watchSessionDockGrid';
import { ShellLeft } from '../../app/components/ShellLeft';
import { shellArrangement } from '../../app/shellArrangement';

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });
const SESSION = brandId<SessionId>({ value: 'session-ledger-core' });
const AGENT = brandId<AgentId>({ value: 'agent-1' });
const SRC = join(__dirname, '..', '..');
const RETIRED_DRAWER_KINDS: ReadonlyArray<string> = [
  'ask',
  'context',
  'explore',
  'session-log',
  'spawned',
];

const FORMER_KEYS = {
  sidebarCollapsed: 'goodboy:sessions-sidebar-collapsed',
  sidebarWidth: 'goodboy:left-sidebar-width:v3',
  sessionRailFoldedCards: 'goodboy:session-rail-folded-cards:v1',
  sessionRailTreeOpen: 'goodboy:session-rail-tree-open:v1',
} as const;

const SAVED_SCROLL: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  board: { queue: 12 },
  session: { review: 40 },
  settings: {},
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const seedStore = async () => {
  await resetStoryStore();
  stubStoryInvoke({});
  useAppStore.setState({
    currentWorkspaceId: WS,
    sessions: [aSession({ id: SESSION })],
    sessionPhaseRuns: { [SESSION]: [anAgent({ id: AGENT, sessionId: SESSION })] },
  });
};

type BlobLike = {
  readonly name: string;
  readonly kind: string;
  readonly blob: object;
  readonly expected?: unknown;
};

type SavedParams = {
  readonly entry: BlobLike;
};

const savedLayoutOf = async ({ entry }: SavedParams) => {
  const label = `win-${entry.kind}`;
  h.settings.set(`window.layout.${label}`, JSON.stringify({ ...entry.blob, at: Date.now() }));
  const layouts = await listWindowLayouts({ nowMs: Date.now() });
  return layouts.find((layout) => layout.label === label);
};

const restoredFrom = async ({ entry }: SavedParams) => {
  const layout = await savedLayoutOf({ entry });
  await useAppStore.getState().restoreLocation({ location: layout!.location });
  return useAppStore.getState();
};

type FormerParams = {
  readonly kind: string;
};

const formerBlobOf = ({ kind }: FormerParams): BlobLike => {
  const entry = PREVIOUS_BUILD_BLOBS.former.find((blob) => blob.kind === kind);
  if (entry === undefined) {
    throw new Error(`no former blob of kind ${kind}`);
  }
  return entry;
};

const studioKindsInSource = (): ReadonlyArray<string> =>
  Array.from(
    readFileSync(join(SRC, 'store/slices/navigation/studio.ts'), 'utf8').matchAll(
      /readonly kind: '(\w+)'/g,
    ),
    (match) => match[1] ?? '',
  );

beforeEach(async () => {
  h.settings.clear();
  await seedStore();
  localStorage.clear();
});

afterEach(cleanup);

describe('layouts saved by the previous build', () => {
  it('holds one fixture for every studio kind and every drawer kind the app has', () => {
    expect(PREVIOUS_BUILD_BLOBS.studios.map((entry) => entry.kind).sort()).toEqual(
      [...studioKindsInSource()].sort(),
    );
    expect(studioKindsInSource()).not.toContain(PREVIOUS_BUILD_BLOBS.workStudio.kind);
    const kinds = PREVIOUS_BUILD_BLOBS.drawers.map((entry) => entry.kind);
    expect(kinds.filter((kind) => !RETIRED_DRAWER_KINDS.includes(kind)).sort()).toEqual(
      Object.keys(DRAWER_KINDS)
        .filter((kind) => ![...UNSAVED_DRAWER_KINDS].some((unsaved) => unsaved === kind))
        .sort(),
    );
    expect(kinds.filter((kind) => RETIRED_DRAWER_KINDS.includes(kind)).sort()).toEqual(
      [...RETIRED_DRAWER_KINDS].sort(),
    );
  });

  it('folds every retired drawer kind of the previous build to its page', async () => {
    const retired = PREVIOUS_BUILD_BLOBS.drawers.filter((entry) =>
      RETIRED_DRAWER_KINDS.includes(entry.kind),
    );

    for (const entry of retired) {
      const state = await restoredFrom({ entry });
      expect(entry.isFolded).toBe(true);
      expect(state.drawer).toBeNull();
      expect(state.activeLens[SESSION] ?? null).toBe(entry.foldedLens);
    }
  });

  it.each(PREVIOUS_BUILD_BLOBS.places)('loads the $name place and restores it', async (entry) => {
    const layout = await savedLayoutOf({ entry });
    expect(layout?.workspaceId).toBe(WS);

    const state = await restoredFrom({ entry });

    expect(state.currentSessionId).toBe(entry.kind === 'session' ? SESSION : null);
    expect(layout?.location.focus.scroll).toEqual(SAVED_SCROLL[entry.kind]);
  });

  it('moves the former review lens of a session place to the branch page', async () => {
    const entry = PREVIOUS_BUILD_BLOBS.places.find((place) => place.kind === 'session');

    const state = await restoredFrom({ entry: entry! });

    expect(state.currentSessionId).toBe(SESSION);
    expect(state.activeLens[SESSION]).toBe('branch');
  });

  it.each(PREVIOUS_BUILD_BLOBS.studios)('loads the $name and restores the page', async (entry) => {
    const layout = await savedLayoutOf({ entry });
    expect(layout?.location.studio).toEqual(entry.stored);

    const state = await restoredFrom({ entry });

    expect(state.appStudio).toEqual(entry.expected);
  });

  it.each([['true'], ['false']] as const)(
    'folds a saved Work page to the board, old Work switch row %s',
    async (oldSwitch) => {
      useAppStore.setState((current) => ({
        settings: { ...current.settings, 'work.enabled': oldSwitch },
      }));

      const state = await restoredFrom({ entry: PREVIOUS_BUILD_BLOBS.workStudio });

      expect(state.appStudio).toBeNull();
      expect(state.currentSessionId).toBeNull();
    },
  );

  it.each(PREVIOUS_BUILD_BLOBS.drawers)(
    'loads the $name and restores the drawer',
    async (entry) => {
      const layout = await savedLayoutOf({ entry });
      expect(layout?.location.focus.drawer).toEqual(entry.expected);

      const state = await restoredFrom({ entry });

      expect(state.currentSessionId).toBe(SESSION);
      if (entry.isFolded) {
        expect(state.drawer).toBeNull();
        expect(state.activeLens[SESSION] ?? null).toBe(entry.foldedLens);
        return;
      }
      expect(state.drawer).toEqual(entry.expected);
    },
  );

  it('does not list a saved draft page as a layout', async () => {
    const entry = PREVIOUS_BUILD_BLOBS.draft;

    expect(await savedLayoutOf({ entry })).toBeUndefined();
  });

  it('moves the companion studio of an older build to the iPhone settings page', async () => {
    const entry = formerBlobOf({ kind: 'companion' });

    const state = await restoredFrom({ entry });

    expect(state.appStudio).toEqual(IPHONE_SETTINGS_PLACE);
  });

  it('moves the retired agents lens of an older build to the lens that replaced it', async () => {
    const entry = formerBlobOf({ kind: 'agents' });

    const state = await restoredFrom({ entry });

    expect(state.currentSessionId).toBe(SESSION);
    expect(state.activeLens[SESSION]).toBe('workflows');
  });

  it('drops the retired run-step drawer of an older build and keeps its session', async () => {
    const entry = formerBlobOf({ kind: 'run-step' });

    const state = await restoredFrom({ entry });

    expect(state.drawer).toBeNull();
    expect(state.currentSessionId).toBe(SESSION);
  });

  it('restores a blob with a session-less Terminal dock on the board, the dock kept', async () => {
    const entry = PREVIOUS_BUILD_BLOBS.terminalDockWithoutSession;

    const layout = await savedLayoutOf({ entry });
    expect(layout).toBeDefined();

    const state = await restoredFrom({ entry });

    expect(state.currentSessionId).toBeNull();
    expect(state.drawer).toEqual({
      kind: 'terminal',
      sessionId: null,
      payload: { terminalId: 'terminal-1' },
    });
  });
});

describe('fold states saved by the previous build', () => {
  it('reads the folded cards of the session level and ignores a name it does not know', () => {
    localStorage.setItem(
      FORMER_KEYS.sessionRailFoldedCards,
      JSON.stringify(['projects', 'folder', 'former-card']),
    );

    expect(renderHook(() => useLevelCardFold({ card: 'projects' })).result.current.isOpen).toBe(
      false,
    );
    expect(renderHook(() => useLevelCardFold({ card: 'folder' })).result.current.isOpen).toBe(
      false,
    );
    expect(renderHook(() => useLevelCardFold({ card: 'linked' })).result.current.isOpen).toBe(true);
  });

  it('reads the tree choices of a session and leaves the other sessions their defaults', () => {
    localStorage.setItem(
      FORMER_KEYS.sessionRailTreeOpen,
      JSON.stringify({ [SESSION]: { 'project:ledger-core': false, 'finished:all': 'x' } }),
    );
    const node = { kind: 'project', id: 'ledger-core', isOpenByDefault: true } as const;
    const finished = { kind: 'finished', id: 'all', isOpenByDefault: true } as const;

    const own = renderHook(() => useRailTreeOpen({ sessionId: SESSION })).result.current;
    const other = renderHook(() =>
      useRailTreeOpen({ sessionId: brandId<SessionId>({ value: 'session-notify-relay' }) }),
    ).result.current;

    expect(own.isOpen(node)).toBe(false);
    expect(own.isOpen(finished)).toBe(true);
    expect(other.isOpen(node)).toBe(true);
  });

  it('falls back to the defaults on a value no build wrote', () => {
    localStorage.setItem(FORMER_KEYS.sessionRailFoldedCards, '{');
    localStorage.setItem(FORMER_KEYS.sessionRailTreeOpen, '[');

    expect(renderHook(() => useLevelCardFold({ card: 'projects' })).result.current.isOpen).toBe(
      true,
    );
    expect(
      renderHook(() => useRailTreeOpen({ sessionId: SESSION })).result.current.isOpen({
        kind: 'project',
        id: 'ledger-core',
        isOpenByDefault: true,
      }),
    ).toBe(true);
  });
});

describe('the dock grid on a database the previous build left', () => {
  it('keeps the Terminal dock of a saved layout on a session that saved no grid', async () => {
    const stop = watchSessionDockGrid({ store: useAppStore, delayMs: 0 });
    const entry = PREVIOUS_BUILD_BLOBS.drawers.find((blob) => blob.kind === 'terminal');
    if (entry === undefined) {
      throw new Error('no Terminal blob of the previous build');
    }

    await restoredFrom({ entry });
    await vi.waitFor(() => {
      expect(selectGridTool({ state: useAppStore.getState(), kind: 'terminal' })).not.toBeNull();
    });
    stop();

    const state = useAppStore.getState();
    expect(state.currentSessionId).toBe(SESSION);
    expect(state.drawer?.kind).toBe('terminal');
    expect(selectGridTool({ state, kind: 'terminal' })).not.toBeNull();
  });

  it('lists the width keys a dock column started from as gone, with no retired row left', () => {
    const lines = readFileSync(join(SRC, '..', '..', '..', 'docs', 'versioning.md'), 'utf8').split(
      '\n',
    );

    expect(
      lines.some((line) => line.startsWith('|') && line.includes(RIGHT_DRAWER_STORAGE_KEY)),
    ).toBe(false);
    expect(lines.some((line) => line.includes(`\`${READER_DRAWER_STORAGE_KEY}\``))).toBe(true);
  });
});

describe('the sidebar a 0.39 build saved', () => {
  const noop = () => undefined;

  const bootShell = () =>
    render(
      createElement(AppShell, {
        leftRail: createElement(ShellLeft, {
          arrangement: shellArrangement({ hasWorkspace: true }),
          workspaceId: WS,
          actions: {
            openBoard: noop,
            openInbox: noop,
            openChat: noop,
            openWorkflows: noop,
            openNewChat: noop,
            openConnections: noop,
            openMonitoring: noop,
            openImpact: noop,
            openSettings: noop,
            openChangelog: noop,
            openGuide: noop,
          },
        }),
        main: createElement('div'),
      }),
    );

  it('boots on the places rail from a folded sidebar 320 wide, and leaves both keys for a return to 0.39', () => {
    localStorage.setItem(FORMER_KEYS.sidebarCollapsed, '1');
    localStorage.setItem(FORMER_KEYS.sidebarWidth, '320');

    bootShell();

    const rail = screen.getByRole('navigation', { name: 'Places' });
    expect(rail.style.width).toBe('64px');
    screen.getByRole('button', { name: 'Board' });
    const grid = rail.closest('aside')?.parentElement;
    expect(grid?.style.gridTemplateColumns).toBe('auto minmax(0,1fr)');
    expect(screen.queryByRole('separator', { name: 'Resize left sidebar' })).toBeNull();
    expect(localStorage.getItem(FORMER_KEYS.sidebarCollapsed)).toBe('1');
    expect(localStorage.getItem(FORMER_KEYS.sidebarWidth)).toBe('320');
  });

  it('draws the same rail from an open sidebar, so the old fold changes nothing', () => {
    localStorage.setItem(FORMER_KEYS.sidebarCollapsed, '0');
    localStorage.setItem(FORMER_KEYS.sidebarWidth, '320');

    bootShell();

    expect(screen.getByRole('navigation', { name: 'Places' }).style.width).toBe('64px');
  });
});
