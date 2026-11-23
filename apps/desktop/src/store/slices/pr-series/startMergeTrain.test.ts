// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PullRequestPort } from '@goodboy/core/review-source';
import { brandId, type MountId, type PullRequestView } from '@goodboy/types';
import { aSession, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import type { MergeTrainCar } from './mergeTrain';
import { startMergeTrain } from './startMergeTrain';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

const WORKSPACE = aWorkspace({ name: 'Acme', slug: 'acme' });
const HARBORLINE = aSession({ workspaceId: WORKSPACE.id });
const NORTHWIND = aSession({ workspaceId: WORKSPACE.id });

const CARS: ReadonlyArray<MergeTrainCar> = [
  {
    sessionId: HARBORLINE.id,
    mountId: brandId<MountId>({ value: 'mount-76' }),
    prNumber: 76,
    repo: 'notify-relay',
    base: 'main',
  },
  {
    sessionId: NORTHWIND.id,
    mountId: brandId<MountId>({ value: 'mount-418' }),
    prNumber: 418,
    repo: 'ledger-core',
    base: 'main',
  },
];

const viewOf = ({ number }: { readonly number: number }): PullRequestView => ({
  host: 'github',
  number,
  title: `Change ${number}`,
  body: '',
  url: `https://github.com/acme/notify-relay/pull/${number}`,
  state: 'approved',
  isDraft: false,
  author: null,
  baseBranch: 'main',
  headBranch: `acme/${number}`,
  headSha: `sha-${number}`,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
  mergedAt: null,
  mergeable: true,
  reviewDecision: 'approved',
  reviewers: [],
  resolves: [],
  checks: { read: 'ok', error: null, runs: [] },
  files: { count: 0, first: [] },
  commits: [],
  mergeMethods: ['squash'],
  mergeMethodReasons: {},
});

const unused = async (): Promise<never> => {
  throw new Error('not used by this test');
};

const portOf = ({ number }: { readonly number: number }): PullRequestPort => ({
  nouns: { long: 'pull request', short: 'PR', numberPrefix: '#' },
  read: async () => viewOf({ number }),
  updateTitle: unused,
  updateBody: unused,
  searchReviewers: unused,
  requestReviewers: unused,
  setDraft: unused,
  merge: unused,
  close: unused,
  reopen: unused,
});

let store: StoryStore;
let merged: Array<number>;

const start = () =>
  startMergeTrain({
    set: store.setState,
    get: store.getState,
    portFor: ({ prNumber }) => portOf({ number: prNumber ?? 0 }),
    sleep: async () => undefined,
  })({ cars: CARS, method: 'squash' });

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  merged = [];
  store.setState({
    workspaces: [WORKSPACE],
    sessions: [HARBORLINE, NORTHWIND],
    mergePr: async (_sessionId, number) => {
      merged.push(number ?? 0);
    },
  });
});

describe('the merge train', () => {
  it('merges nothing until you start it', () => {
    expect(store.getState().mergeTrain).toBeNull();
    expect(merged).toEqual([]);
  });

  it('runs every car and leaves the outcome on the strip until dismissed', async () => {
    const result = await start();

    expect(result).toEqual({ kind: 'done', merged: 2 });
    expect(merged).toEqual([76, 418]);
    const train = store.getState().mergeTrain;
    expect(train).toMatchObject({ merged: 2, outcome: { kind: 'done' } });
    store.getState().dismissMergeTrain({ id: train?.id ?? '' });
    expect(store.getState().mergeTrain).toBeNull();
  });

  it('refuses a second train while one runs', async () => {
    let release: (() => void) | undefined;
    store.setState({
      mergePr: async (_sessionId, number) => {
        merged.push(number ?? 0);
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    });
    const first = start();
    await vi.waitFor(() => expect(merged).toEqual([76]));

    expect(await start()).toEqual({ kind: 'busy' });
    store.getState().dismissMergeTrain({ id: store.getState().mergeTrain?.id ?? '' });
    expect(store.getState().mergeTrain).not.toBeNull();

    store.setState({
      mergePr: async (_sessionId, number) => {
        merged.push(number ?? 0);
      },
    });
    release?.();
    await first;
  });

  it('stops after this one when asked mid-run, and the stop cannot be asked twice', async () => {
    let release: (() => void) | undefined;
    store.setState({
      mergePr: async (_sessionId, number) => {
        merged.push(number ?? 0);
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    });
    const running = start();
    await vi.waitFor(() => expect(merged).toEqual([76]));

    expect(store.getState().stopMergeTrainAfterThis()).toBe(true);
    expect(store.getState().stopMergeTrainAfterThis()).toBe(false);
    release?.();

    expect(await running).toEqual({ kind: 'halted', merged: 1 });
    expect(merged).toEqual([76]);
    expect(store.getState().mergeTrain).toMatchObject({ merged: 1, outcome: { kind: 'halted' } });
  });

  it('starts again after a stop, so a retry needs no dismiss first', async () => {
    store.setState({
      mergePr: async () => {
        throw new Error('405 Method Not Allowed');
      },
    });
    await start();
    expect(store.getState().mergeTrain?.outcome?.kind).toBe('stopped');
    store.setState({
      mergePr: async (_sessionId, number) => {
        merged.push(number ?? 0);
      },
    });

    expect(await start()).toEqual({ kind: 'done', merged: 2 });
    expect(merged).toEqual([76, 418]);
  });

  it('keeps the stop reason on the strip when a car cannot merge', async () => {
    store.setState({
      mergePr: async () => {
        throw new Error('405 Method Not Allowed');
      },
    });

    await start();

    expect(store.getState().mergeTrain?.outcome).toMatchObject({
      kind: 'stopped',
      isWithLead: false,
    });
    expect(store.getState().mergeTrain?.index).toBe(0);
  });
});
