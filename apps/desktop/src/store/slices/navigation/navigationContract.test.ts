// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import {
  brandId,
  type AgentId,
  type MountId,
  type ProjectId,
  type SessionId,
  type SessionProjectMount,
  type WorkspaceId,
} from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import type { AppStore } from '../../store';
import { STORE_IMPORT_TIMEOUT_MS, importStore, type StoryStore } from '../../storyHarness';
import { parseLocation } from '../../../features/workspace/windowLayout';
import { createDrawerSlice } from '../drawer';
import { createNavigationSlice } from '.';
import { backOf } from './backOf';
import { canonicalLocation } from './canonicalLocation';
import { captureWindowLocation } from './captureWindowLocation';
import { agentPlace, branchPlace, sessionPlace } from './place';
import { PLACE_ROWS } from './placeRows';
import type { Location, Place } from './types';

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });
const S1 = brandId<SessionId>({ value: 'session-ledger-core' });
const LEAD = brandId<AgentId>({ value: 'agent-lead' });
const SCOUT = brandId<AgentId>({ value: 'agent-scout' });
const WORKTREE = '/work/ledger-core';

const MOUNT: SessionProjectMount = {
  mountId: brandId<MountId>({ value: 'mount-ledger-core' }),
  sessionId: S1,
  projectId: brandId<ProjectId>({ value: 'project-ledger-core' }),
  mountName: 'ledger-core',
  worktreePath: WORKTREE,
  lastWorktreePath: null,
  repoRoot: '/repo/ledger-core',
  branch: 'ak/settlement-batch',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type WindowParams = {
  readonly hasBranch?: boolean;
};

const windowStore = ({ hasBranch = false }: WindowParams = {}) =>
  create<AppStore>()((set, get) => ({
    ...useAppStore.getInitialState(),
    currentWorkspaceId: WS,
    currentSessionId: null,
    sessions: [aSession({ id: S1 })],
    navigation: {},
    appStudio: null,
    drawer: null,
    sessionProjectMounts: hasBranch ? { [S1]: [MOUNT] } : {},
    sessionPhaseRuns: {
      [S1]: [
        anAgent({ id: LEAD, sessionId: S1, name: 'planner' }),
        anAgent({ id: SCOUT, sessionId: S1, name: 'scout', parentAgentId: LEAD }),
      ],
    },
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

type Store = ReturnType<typeof windowStore>;

type StoreParams = {
  readonly store: Store;
};

const placeOf = ({ store }: StoreParams): Place =>
  captureWindowLocation({ state: store.getState() }).place;

const topOf = ({ store }: StoreParams): Location =>
  captureWindowLocation({ state: store.getState() });

const backRowOf = ({ store }: StoreParams): Place | null =>
  backOf({ state: store.getState(), place: placeOf({ store }) })?.to ?? null;

const depthOf = ({ store }: StoreParams): number =>
  store.getState().navigation[WS]?.entries.length ?? 0;

const reloaded = async ({
  store,
  hasBranch = false,
}: StoreParams & WindowParams): Promise<Store> => {
  const saved = parseLocation({ value: JSON.parse(JSON.stringify(topOf({ store }))) });
  const after = windowStore({ hasBranch });
  expect(saved).not.toBeNull();
  if (saved !== null) {
    await after.getState().restoreLocation({ location: saved });
  }
  return after;
};

const LEAD_PAGE = sessionPlace({ sessionId: S1, lens: 'workflows', agentId: LEAD });

const OVERVIEW = sessionPlace({ sessionId: S1 });

const RUNS = sessionPlace({ sessionId: S1, lens: 'workflows' });

const WORK_TAB = branchPlace({ sessionId: S1, mountPath: WORKTREE, tab: 'work' });

describe('one page for a Lead', () => {
  it('resolves every door to the Lead to the same address', () => {
    const store = windowStore();
    store.getState().navigate({ to: agentPlace({ sessionId: S1, agentId: LEAD }) });

    expect(placeOf({ store })).toEqual(LEAD_PAGE);
  });
});

describe('the back row and History Back', () => {
  it('Lead to session: the back row goes to the Overview with the Lead row, History Back to Runs', () => {
    const store = windowStore();
    store.getState().navigate({ to: RUNS });
    store.getState().navigate({ to: agentPlace({ sessionId: S1, agentId: LEAD }) });

    expect(backRowOf({ store })).toEqual(OVERVIEW);

    store.getState().back();
    expect(placeOf({ store })).toEqual(RUNS);

    store.getState().forward();
    store.getState().up();
    expect(placeOf({ store })).toEqual(OVERVIEW);
    expect(topOf({ store }).focus.returnRows).toEqual({ [PLACE_ROWS.boardLead]: LEAD });
  });

  it('Work tab to Lead: the back row returns to the tab, never to a list', () => {
    const store = windowStore({ hasBranch: true });
    store.getState().navigate({ to: OVERVIEW });
    store.getState().navigate({ to: agentPlace({ sessionId: S1, agentId: LEAD }) });
    store.getState().amendFocus({ patch: { runGroup: { groupKey: 'lead', mountPath: WORKTREE } } });

    expect(backRowOf({ store })).toEqual(WORK_TAB);

    store.getState().back();
    expect(placeOf({ store })).toEqual(OVERVIEW);
  });

  it('a sub agent goes back to its Lead page', () => {
    const store = windowStore();
    store.getState().navigate({ to: agentPlace({ sessionId: S1, agentId: SCOUT }) });

    expect(backRowOf({ store })).toEqual(LEAD_PAGE);
  });

  it('a direct open: the back row has the Overview, History Back has nothing', async () => {
    const store = windowStore();
    await store.getState().restoreLocation({
      location: {
        workspaceId: WS,
        place: LEAD_PAGE,
        studio: null,
        focus: { drawer: null, scroll: {} },
      },
    });

    expect(backRowOf({ store })).toEqual(OVERVIEW);
    expect(depthOf({ store })).toBe(1);

    store.getState().back();
    expect(placeOf({ store })).toEqual(LEAD_PAGE);
  });

  it('a reload: the back row is the same, History Back is empty', async () => {
    const before = windowStore({ hasBranch: true });
    before.getState().navigate({ to: RUNS });
    before.getState().navigate({ to: agentPlace({ sessionId: S1, agentId: LEAD }) });
    before
      .getState()
      .amendFocus({ patch: { runGroup: { groupKey: 'lead', mountPath: WORKTREE } } });

    const after = await reloaded({ store: before, hasBranch: true });

    expect(placeOf({ store: after })).toEqual(LEAD_PAGE);
    expect(backRowOf({ store: after })).toEqual(WORK_TAB);
    expect(depthOf({ store: after })).toBe(1);
    after.getState().back();
    expect(placeOf({ store: after })).toEqual(LEAD_PAGE);
  });

  it('puts no back row on a session tab', () => {
    const store = windowStore();
    store.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'context' }) });

    expect(backRowOf({ store })).toBeNull();
  });
});

describe('two windows', () => {
  it('each window restores its own tab, row and record', async () => {
    const left = windowStore();
    left.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'context' }) });
    left
      .getState()
      .amendFocus({ patch: { returnRows: { [PLACE_ROWS.contextSection]: 'decisions' } } });
    const right = windowStore();
    right.getState().navigate({ to: agentPlace({ sessionId: S1, agentId: SCOUT }) });

    const leftAfter = await reloaded({ store: left });
    const rightAfter = await reloaded({ store: right });

    expect(leftAfter.getState().activeLens[S1]).toBe('context');
    expect(topOf({ store: leftAfter }).focus.returnRows).toEqual({
      [PLACE_ROWS.contextSection]: 'decisions',
    });
    expect(leftAfter.getState().selectedAgentId[S1] ?? null).toBeNull();
    expect(rightAfter.getState().activeLens[S1]).toBe('workflows');
    expect(rightAfter.getState().selectedAgentId[S1]).toBe(SCOUT);
    expect(topOf({ store: rightAfter }).focus.returnRows).toBeUndefined();
  });
});

describe('the Changes tab on every session', () => {
  it('stays on the session on a session with branches, on its branch', () => {
    const store = windowStore({ hasBranch: true });

    const { place } = canonicalLocation({
      state: store.getState(),
      request: sessionPlace({ sessionId: S1, lens: 'files' }),
    });

    expect(place).toEqual(
      sessionPlace({
        sessionId: S1,
        lens: 'files',
        target: { kind: 'diff', mountPath: WORKTREE, focus: null },
      }),
    );
  });

  it('keeps a session without branches on its Changes page', () => {
    const store = windowStore();

    expect(
      canonicalLocation({
        state: store.getState(),
        request: sessionPlace({ sessionId: S1, lens: 'files' }),
      }).place,
    ).toEqual(sessionPlace({ sessionId: S1, lens: 'files' }));
  });

  it('opens a stored history page as the commits of the pull request', () => {
    const store = windowStore({ hasBranch: true });

    expect(
      canonicalLocation({
        state: store.getState(),
        request: sessionPlace({
          sessionId: S1,
          lens: 'files',
          target: { kind: 'diff', mountPath: WORKTREE, focus: null, page: 'history' },
        }),
      }).place,
    ).toEqual(branchPlace({ sessionId: S1, mountPath: WORKTREE, tab: 'commits' }));
  });

  it('saves the branch the Changes tab shows', async () => {
    const before = windowStore({ hasBranch: true });
    before.getState().navigate({ to: sessionPlace({ sessionId: S1, lens: 'files' }) });

    const after = await reloaded({ store: before, hasBranch: true });

    expect(placeOf({ store: after })).toEqual(
      sessionPlace({
        sessionId: S1,
        lens: 'files',
        target: { kind: 'diff', mountPath: WORKTREE, focus: null },
      }),
    );
  });

  it('opens an unknown stored page on the Overview', async () => {
    const store = windowStore();
    const stored: Location = JSON.parse(
      JSON.stringify({
        workspaceId: WS,
        place: {
          at: 'session',
          sessionId: S1,
          view: { lens: 'timeline', agentId: null, target: null },
        },
        studio: null,
        focus: { drawer: null, scroll: {} },
      }),
    );

    await store.getState().restoreLocation({ location: stored });

    expect(placeOf({ store })).toEqual(OVERVIEW);
  });
});
