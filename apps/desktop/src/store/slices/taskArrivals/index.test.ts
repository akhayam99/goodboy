// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';

const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const OTHER = brandId<WorkspaceId>({ value: 'workspace-northwind' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 } });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(1_000);
});

afterEach(() => {
  vi.useRealTimers();
});

type NoteParams = {
  readonly workspaceId?: WorkspaceId;
  readonly forMe?: ReadonlyArray<string>;
  readonly others?: ReadonlyArray<string>;
};

const note = ({ workspaceId = WORKSPACE, forMe = [], others = [] }: NoteParams): void => {
  useAppStore.getState().noteTaskRecords({
    workspaceId,
    records: [
      ...forMe.map((key) => ({ key, isForMe: true })),
      ...others.map((key) => ({ key, isForMe: false })),
    ],
  });
};

const newKeys = (workspaceId: WorkspaceId = WORKSPACE): ReadonlyArray<string> =>
  useAppStore.getState().taskNewKeys[workspaceId] ?? [];

const forgetMemory = (): void => {
  useAppStore.setState({ taskArrivals: {}, taskNewKeys: {} });
};

describe('task arrivals', () => {
  it('counts nothing as new before the first look, however much loads', () => {
    note({ forMe: ['github:acme/ledger-core#1'], others: ['sentry:payments-api-9'] });
    vi.setSystemTime(2_000);
    note({ forMe: ['github:acme/ledger-core#1', 'linear:NW-4'] });

    expect(newKeys()).toEqual([]);
    expect(useAppStore.getState().taskArrivals[WORKSPACE]?.firstSeen.size).toBe(3);
  });

  it('marks what arrives after a look as new, for the items that are for me only', () => {
    note({ forMe: ['github:acme/ledger-core#1'] });
    vi.setSystemTime(2_000);
    useAppStore.getState().markTasksSeen({ workspaceId: WORKSPACE });

    vi.setSystemTime(3_000);
    note({
      forMe: ['github:acme/ledger-core#1', 'github:acme/ledger-core#2'],
      others: ['sentry:payments-api-9'],
    });

    expect(newKeys()).toEqual(['github:acme/ledger-core#2']);
  });

  it('clears the new ones when the page is looked at again', () => {
    note({ forMe: ['a'] });
    useAppStore.getState().markTasksSeen({ workspaceId: WORKSPACE });
    vi.setSystemTime(2_000);
    note({ forMe: ['a', 'b'] });
    expect(newKeys()).toEqual(['b']);

    vi.setSystemTime(3_000);
    useAppStore.getState().markTasksSeen({ workspaceId: WORKSPACE });

    expect(newKeys()).toEqual([]);
  });

  it('keeps the first-seen stamps and the look across a reload', () => {
    note({ forMe: ['a'] });
    vi.setSystemTime(1_500);
    useAppStore.getState().markTasksSeen({ workspaceId: WORKSPACE });
    vi.setSystemTime(2_000);
    note({ forMe: ['a', 'b'] });
    forgetMemory();

    vi.setSystemTime(9_000);
    note({ forMe: ['a', 'b', 'c'] });

    expect(newKeys()).toEqual(['b', 'c']);
    const arrivals = useAppStore.getState().taskArrivals[WORKSPACE];
    expect(arrivals?.seenAt).toBe(1_500);
    expect(Object.fromEntries(arrivals?.firstSeen ?? [])).toEqual({ a: 1_000, b: 2_000, c: 9_000 });
  });

  it('keeps each workspace apart', () => {
    note({ forMe: ['a'] });
    useAppStore.getState().markTasksSeen({ workspaceId: WORKSPACE });
    vi.setSystemTime(2_000);

    note({ workspaceId: OTHER, forMe: ['a'] });

    expect(newKeys(OTHER)).toEqual([]);
    expect(useAppStore.getState().taskArrivals[OTHER]?.seenAt).toBeNull();
  });

  it('does not rewrite the store when nothing changed', () => {
    note({ forMe: ['a'] });
    const before = useAppStore.getState().taskArrivals;

    note({ forMe: ['a'] });

    expect(useAppStore.getState().taskArrivals).toBe(before);
  });
});
