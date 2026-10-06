// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionViewPrefs, WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../../shared/lib/storage-keys';
import { createSessionViewSlice } from '.';
import { DEFAULT_PREFS } from './types';

const WS = 'workspace-harborline' as WorkspaceId;
const WS2 = 'workspace-northwind' as WorkspaceId;

const buildLocalStorageMock = () => {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
    }),
    store,
  };
};

const storageKey = (workspaceId: WorkspaceId): string =>
  `${STORAGE_PREFIXES.sessionView}${workspaceId}`;

type SliceState = ReturnType<typeof createSessionViewSlice>;

const buildSlice = (): { actions: SliceState; getState: () => SliceState } => {
  let state = {} as SliceState;
  const set = (updater: Partial<SliceState> | ((s: SliceState) => Partial<SliceState>)) => {
    state = { ...state, ...(typeof updater === 'function' ? updater(state) : updater) };
  };
  const get = (): SliceState => state;
  const actions = createSessionViewSlice({
    set: set as Parameters<typeof createSessionViewSlice>[0]['set'],
    get: get as Parameters<typeof createSessionViewSlice>[0]['get'],
  });
  state = { ...actions };
  return { actions, getState: get };
};

const persisted = (prefs: Partial<SessionViewPrefs> & { readonly v: number }): string =>
  JSON.stringify({ ...DEFAULT_PREFS, ...prefs });

let ls: ReturnType<typeof buildLocalStorageMock>;

beforeEach(() => {
  ls = buildLocalStorageMock();
  vi.stubGlobal('localStorage', ls);
});

describe('the session list prefs of a workspace', () => {
  it('start on Needs you first, no grouping, archived hidden and the fold closed', () => {
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual({
      sort: 'needsYou',
      group: 'none',
      isArchivedShown: false,
      isFoldOpen: false,
    });
  });

  it('read what was persisted', () => {
    ls.store[storageKey(WS)] = persisted({
      v: 2,
      sort: 'goal',
      group: 'project',
      isArchivedShown: true,
      isFoldOpen: true,
    });
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual({
      sort: 'goal',
      group: 'project',
      isArchivedShown: true,
      isFoldOpen: true,
    });
  });

  it('are read once and then cached', () => {
    ls.store[storageKey(WS)] = persisted({ v: 2, sort: 'createdAt', group: 'pr' });
    const { actions } = buildSlice();
    actions.getSessionViewPrefs(WS);
    const reads = ls.getItem.mock.calls.length;
    actions.getSessionViewPrefs(WS);
    expect(ls.getItem.mock.calls.length).toBe(reads);
  });

  it('reset to the new defaults when the stored prefs are from before the redesign', () => {
    ls.store[storageKey(WS)] = JSON.stringify({ v: 1, sort: 'goal', group: 'pr' });
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual(DEFAULT_PREFS);
    expect(JSON.parse(ls.store[storageKey(WS)] ?? '{}')).toMatchObject({ v: 2, sort: 'needsYou' });
  });
});

describe('changing the session list prefs', () => {
  it('updates the state and persists with the version', () => {
    const { actions, getState } = buildSlice();
    actions.setSessionViewPrefs({ workspaceId: WS, patch: { sort: 'goal' } });
    expect(getState().sessionViewPrefs[WS]?.sort).toBe('goal');
    expect(JSON.parse(ls.store[storageKey(WS)] ?? '{}')).toMatchObject({ v: 2, sort: 'goal' });
  });

  it('changes only what the patch names', () => {
    ls.store[storageKey(WS)] = persisted({
      v: 2,
      sort: 'createdAt',
      group: 'pr',
      isFoldOpen: true,
    });
    const { actions, getState } = buildSlice();
    actions.getSessionViewPrefs(WS);
    actions.setSessionViewPrefs({ workspaceId: WS, patch: { group: 'stage' } });
    expect(getState().sessionViewPrefs[WS]).toEqual({
      sort: 'createdAt',
      group: 'stage',
      isArchivedShown: false,
      isFoldOpen: true,
    });
  });

  it('works on a workspace that was never read', () => {
    const { actions } = buildSlice();
    actions.setSessionViewPrefs({ workspaceId: WS, patch: { isArchivedShown: true } });
    expect(JSON.parse(ls.store[storageKey(WS)] ?? '{}').isArchivedShown).toBe(true);
  });

  it('keeps each workspace apart', () => {
    ls.store[storageKey(WS)] = persisted({ v: 2, sort: 'goal', group: 'stage' });
    ls.store[storageKey(WS2)] = persisted({ v: 2, sort: 'createdAt', group: 'pr' });
    const { actions, getState } = buildSlice();
    actions.getSessionViewPrefs(WS);
    actions.getSessionViewPrefs(WS2);
    actions.setSessionViewPrefs({ workspaceId: WS, patch: { sort: 'updatedAt' } });
    expect(getState().sessionViewPrefs[WS2]).toMatchObject({ sort: 'createdAt', group: 'pr' });
    expect(JSON.parse(ls.store[storageKey(WS2)] ?? '{}')).toMatchObject({ sort: 'createdAt' });
  });

  it('swallows a full storage and still updates the state', () => {
    ls.setItem.mockImplementationOnce(() => {
      throw new DOMException('QuotaExceededError');
    });
    const { actions, getState } = buildSlice();
    expect(() =>
      actions.setSessionViewPrefs({ workspaceId: WS, patch: { sort: 'goal' } }),
    ).not.toThrow();
    expect(getState().sessionViewPrefs[WS]?.sort).toBe('goal');
  });
});

describe('storage that cannot be trusted', () => {
  it('falls back to the defaults on corrupted JSON', () => {
    ls.store[storageKey(WS)] = 'not json!!!';
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual(DEFAULT_PREFS);
  });

  it('falls back to the defaults on an unknown version and heals the entry', () => {
    ls.store[storageKey(WS)] = JSON.stringify({ v: 99, sort: 'goal', group: 'pr' });
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual(DEFAULT_PREFS);
    expect(JSON.parse(ls.store[storageKey(WS)] ?? '{}')).toMatchObject({ v: 2 });
  });

  it('keeps a valid group when the sort is not one we know', () => {
    ls.store[storageKey(WS)] = JSON.stringify({
      ...DEFAULT_PREFS,
      v: 2,
      sort: 'invalid',
      group: 'pr',
    });
    const { actions } = buildSlice();
    const prefs = actions.getSessionViewPrefs(WS);
    expect(prefs.sort).toBe(DEFAULT_PREFS.sort);
    expect(prefs.group).toBe('pr');
  });

  it('keeps a valid sort when the group is not one we know', () => {
    ls.store[storageKey(WS)] = JSON.stringify({
      ...DEFAULT_PREFS,
      v: 2,
      sort: 'goal',
      group: 'invalid',
    });
    const { actions } = buildSlice();
    const prefs = actions.getSessionViewPrefs(WS);
    expect(prefs.sort).toBe('goal');
    expect(prefs.group).toBe(DEFAULT_PREFS.group);
  });

  it('ignores a flag that is not a boolean', () => {
    ls.store[storageKey(WS)] = JSON.stringify({ ...DEFAULT_PREFS, v: 2, isFoldOpen: 'yes' });
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS).isFoldOpen).toBe(false);
  });

  it('returns the defaults when the storage cannot be read', () => {
    ls.getItem.mockImplementationOnce(() => {
      throw new Error('storage unavailable');
    });
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual(DEFAULT_PREFS);
  });

  it('returns the defaults when nothing was stored', () => {
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual(DEFAULT_PREFS);
    expect(ls.setItem).not.toHaveBeenCalled();
  });

  it('writes nothing for a stored value that is already valid', () => {
    ls.store[storageKey(WS)] = persisted({ v: 2 });
    const { actions } = buildSlice();
    actions.getSessionViewPrefs(WS);
    expect(ls.setItem).not.toHaveBeenCalled();
  });
});
