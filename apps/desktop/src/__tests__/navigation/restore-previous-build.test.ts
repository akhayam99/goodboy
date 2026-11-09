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
import { cleanup, renderHook } from '@testing-library/react';
import { create } from 'zustand';
import { brandId, type AgentId, type SessionId, type WorkspaceId } from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import type { AppStore } from '../../store/store';
import { STORE_IMPORT_TIMEOUT_MS, importStore, type StoryStore } from '../../test/storyHarness';
import { createDrawerSlice } from '../../store/slices/drawer';
import { DRAWER_KINDS } from '../../store/slices/drawer/drawerKinds';
import { createNavigationSlice } from '../../store/slices/navigation';
import { STORAGE_KEYS } from '../../shared/lib/storage-keys';
import { listWindowLayouts } from '../../features/workspace/windowLayout';
import { useSessionSidebarVisibility } from '../../features/workspace/hooks/useSessionSidebarVisibility';
import { useSessionRailFold } from '../../app/components/SessionRail/useSessionRailFold';
import { useLevelCardFold } from '../../app/components/SessionRail/SessionLevel/useLevelCardFold';
import { useRailTreeOpen } from '../../app/components/SessionRail/SessionLevel/useRailTreeOpen';
import { PREVIOUS_BUILD_BLOBS } from './previousBuildBlobs';

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });
const SESSION = brandId<SessionId>({ value: 'session-ledger-core' });
const AGENT = brandId<AgentId>({ value: 'agent-1' });
const SRC = join(__dirname, '..', '..');

const SAVED_SCROLL: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  board: { queue: 12 },
  session: { review: 40 },
  settings: {},
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const restoreTestStore = () =>
  create<AppStore>()((set, get) => ({
    ...useAppStore.getInitialState(),
    currentWorkspaceId: WS,
    currentSessionId: null,
    sessions: [aSession({ id: SESSION })],
    navigation: {},
    appStudio: null,
    activeLens: {},
    selectedAgentId: {},
    focusedWorkflowRunId: {},
    focusedArtifactId: {},
    drawer: null,
    sessionPhaseRuns: { [SESSION]: [anAgent({ id: AGENT, sessionId: SESSION })] },
    setCurrentSession: async (id: SessionId | null) => {
      set((state) => ({
        currentSessionId: id,
        activeLens: id === null ? state.activeLens : { ...state.activeLens, [id]: null },
      }));
    },
    selectAgent: async (sessionId: SessionId, agentId: AgentId) => {
      set((state) => ({ selectedAgentId: { ...state.selectedAgentId, [sessionId]: agentId } }));
    },
    ...createNavigationSlice({ set, get }),
    ...createDrawerSlice({ set, get }),
  }));

type BlobLike = { readonly name: string; readonly kind: string; readonly blob: object };

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
  const store = restoreTestStore();
  await store.getState().restoreLocation({ location: layout!.location });
  return store.getState();
};

const studioKindsInSource = (): ReadonlyArray<string> =>
  Array.from(
    readFileSync(join(SRC, 'store/slices/navigation/studio.ts'), 'utf8').matchAll(
      /readonly kind: '(\w+)'/g,
    ),
    (match) => match[1] ?? '',
  );

beforeEach(() => {
  h.settings.clear();
  localStorage.clear();
});

afterEach(cleanup);

describe('layouts saved by the previous build', () => {
  it('holds one fixture for every studio kind and every drawer kind the app has', () => {
    expect(PREVIOUS_BUILD_BLOBS.studios.map((entry) => entry.kind).sort()).toEqual(
      [...studioKindsInSource()].sort(),
    );
    expect(PREVIOUS_BUILD_BLOBS.drawers.map((entry) => entry.kind).sort()).toEqual(
      Object.keys(DRAWER_KINDS).sort(),
    );
  });

  it.each(PREVIOUS_BUILD_BLOBS.places)('loads the $name place and restores it', async (entry) => {
    const layout = await savedLayoutOf({ entry });
    expect(layout?.workspaceId).toBe(WS);

    const state = await restoredFrom({ entry });

    expect(state.currentSessionId).toBe(entry.kind === 'session' ? SESSION : null);
    expect(layout?.location.focus.scroll).toEqual(SAVED_SCROLL[entry.kind]);
  });

  it.each(PREVIOUS_BUILD_BLOBS.studios)('loads the $name and restores the page', async (entry) => {
    const layout = await savedLayoutOf({ entry });
    expect(layout?.location.studio).toMatchObject({ kind: entry.kind });

    const state = await restoredFrom({ entry });

    expect(state.appStudio).toMatchObject({ kind: entry.kind });
  });

  it.each(PREVIOUS_BUILD_BLOBS.drawers)(
    'loads the $name and restores the drawer',
    async (entry) => {
      const layout = await savedLayoutOf({ entry });
      expect(layout?.location.focus.drawer).toMatchObject({ kind: entry.kind, sessionId: SESSION });

      const state = await restoredFrom({ entry });

      expect(state.currentSessionId).toBe(SESSION);
      expect(state.drawer).toMatchObject({ kind: entry.kind, sessionId: SESSION });
    },
  );

  it('drops a saved draft page and keeps the window on its previous screen, without a crash', async () => {
    const entry = PREVIOUS_BUILD_BLOBS.draft;

    expect(await savedLayoutOf({ entry })).toBeUndefined();
  });

  it.each(PREVIOUS_BUILD_BLOBS.former)('migrates the $name on restore', async (entry) => {
    const state = await restoredFrom({ entry });

    expect(state.appStudio?.kind).not.toBe('companion');
    expect(state.drawer?.kind).not.toBe('run-step');
    expect(state.activeLens[SESSION] ?? null).not.toBe('agents');
  });

  it('restores a blob with a session-less Terminal dock without a crash', async () => {
    const entry = PREVIOUS_BUILD_BLOBS.terminalDockWithoutSession;

    const layout = await savedLayoutOf({ entry });
    expect(layout).toBeDefined();

    await expect(restoredFrom({ entry })).resolves.toBeDefined();
  });
});

describe('fold states saved by the previous build', () => {
  it('reads the folded main sidebar and the open one', () => {
    localStorage.setItem(STORAGE_KEYS.sessionSidebarCollapsed, '1');
    const folded = renderHook(() => useSessionSidebarVisibility({ hasSidebar: true }));
    expect(folded.result.current.isCollapsed).toBe(true);

    localStorage.setItem(STORAGE_KEYS.sessionSidebarCollapsed, '0');
    const open = renderHook(() => useSessionSidebarVisibility({ hasSidebar: true }));
    expect(open.result.current.isCollapsed).toBe(false);
  });

  it('reads the folded session rail and the open one', () => {
    localStorage.setItem(STORAGE_KEYS.sessionRailCollapsed, '1');
    const folded = renderHook(() => useSessionRailFold({ isNarrow: false }));
    expect(folded.result.current.isFolded).toBe(true);

    localStorage.setItem(STORAGE_KEYS.sessionRailCollapsed, '0');
    const open = renderHook(() => useSessionRailFold({ isNarrow: false }));
    expect(open.result.current.isFolded).toBe(false);
  });

  it('reads the folded cards of the session level and ignores a name it does not know', () => {
    localStorage.setItem(
      STORAGE_KEYS.sessionRailFoldedCards,
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
      STORAGE_KEYS.sessionRailTreeOpen,
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
    localStorage.setItem(STORAGE_KEYS.sessionSidebarCollapsed, 'maybe');
    localStorage.setItem(STORAGE_KEYS.sessionRailCollapsed, '{');
    localStorage.setItem(STORAGE_KEYS.sessionRailFoldedCards, '{');
    localStorage.setItem(STORAGE_KEYS.sessionRailTreeOpen, '[');

    expect(
      renderHook(() => useSessionSidebarVisibility({ hasSidebar: true })).result.current
        .isCollapsed,
    ).toBe(false);
    expect(renderHook(() => useSessionRailFold({ isNarrow: false })).result.current.isFolded).toBe(
      false,
    );
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
