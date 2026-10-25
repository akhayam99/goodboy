// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PullRequestPort } from '@goodboy/core';
import {
  brandId,
  type MountId,
  type PrSeriesId,
  type PrSeriesMemberId,
  type PrSeriesView,
  type PullRequestState,
  type PullRequestView,
} from '@goodboy/types';
import { aProject, aSession, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { aMountGithub } from '../github/testing/aMountGithub';
import { mergeSeriesInOrder } from './mergeSeriesInOrder';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

const WORKSPACE = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const PROJECT = aProject({ workspaceId: WORKSPACE.id, name: 'ledger-core' });
const SESSION = aSession({ workspaceId: WORKSPACE.id });
const SERIES_ID = brandId<PrSeriesId>({ value: 'series-ledger-rounding' });
const MOUNTS = [1, 2, 3].map((part) => brandId<MountId>({ value: `mount-rounding-${part}` }));

const memberOf = ({ ordinal }: { readonly ordinal: number }): PrSeriesView['members'][number] => ({
  id: brandId<PrSeriesMemberId>({ value: `member-${ordinal}` }),
  seriesId: SERIES_ID,
  mountId: MOUNTS[ordinal - 1] ?? null,
  branch: `ledger-rounding-${ordinal}`,
  ordinal,
  label: String(ordinal),
  status: 'active',
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
  request: null,
});

const SERIES: PrSeriesView = {
  id: SERIES_ID,
  sessionId: SESSION.id,
  projectId: PROJECT.id,
  name: 'ledger-rounding',
  workItemIdentifier: null,
  workItemUrl: null,
  plannedCount: 3,
  parentRequest: null,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
  members: [1, 2, 3].map((ordinal) => memberOf({ ordinal })),
};

const pullRequestOf = ({
  number,
  state,
}: {
  readonly number: number;
  readonly state: PullRequestState['state'];
}): PullRequestState => ({
  number,
  title: `Rounding part ${number}`,
  url: `https://github.com/harborline/ledger-core/pull/${number}`,
  state,
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: `ledger-rounding-${number}`,
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: TEST_NOW,
});

type ViewParams = {
  readonly number: number;
  readonly overrides?: Partial<PullRequestView>;
};

const viewOf = ({ number, overrides = {} }: ViewParams): PullRequestView => ({
  host: 'github',
  number,
  title: `Rounding part ${number}`,
  body: '',
  url: `https://github.com/harborline/ledger-core/pull/${number}`,
  state: 'approved',
  isDraft: false,
  author: null,
  baseBranch: 'main',
  headBranch: `ledger-rounding-${number}`,
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
  mergeMethods: ['squash', 'merge'],
  mergeMethodReasons: {},
  ...overrides,
});

let store: StoryStore;
let views: Record<number, PullRequestView>;
let order: Array<string>;
let merges: Array<{
  readonly number: number | undefined;
  readonly method: string | undefined;
  readonly mountId: MountId | undefined;
  readonly head: string | null | undefined;
}>;

type MergePr = ReturnType<StoryStore['getState']>['mergePr'];

const mergePr: MergePr = async (_sessionId, number, method, options) => {
  order.push(`merge ${number}`);
  merges.push({
    number,
    method,
    mountId: options?.mountId,
    head: options?.expectedHeadSha,
  });
};

const unused = async (): Promise<never> => {
  throw new Error('not used by this test');
};

const portOf = ({ number }: { readonly number: number }): PullRequestPort => ({
  nouns: { long: 'pull request', short: 'PR', numberPrefix: '#' },
  read: async () => {
    order.push(`read ${number}`);
    const view = views[number];
    if (view === undefined) {
      throw new Error('the part is gone');
    }
    return view;
  },
  updateTitle: unused,
  updateBody: unused,
  searchReviewers: unused,
  requestReviewers: unused,
  setDraft: unused,
  merge: unused,
  close: unused,
  reopen: unused,
});

const seed = ({ merged }: { readonly merged: number }) => {
  store.setState({
    workspaces: [WORKSPACE],
    projects: [PROJECT],
    sessions: [SESSION],
    prSeries: { [SESSION.id]: [SERIES] },
    mountGithub: Object.fromEntries(
      MOUNTS.map((mountId, index) => [
        mountId,
        {
          ...aMountGithub({ mountId, projectId: PROJECT.id }),
          pr: pullRequestOf({ number: index + 1, state: index < merged ? 'merged' : 'open' }),
        },
      ]),
    ),
    mergePr,
  });
};

type PortFor = NonNullable<Parameters<typeof mergeSeriesInOrder>[0]['portFor']>;

let portFor: PortFor;

const run = () =>
  mergeSeriesInOrder({ get: store.getState, portFor })({
    sessionId: SESSION.id,
    seriesId: SERIES_ID,
  });

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  order = [];
  views = { 1: viewOf({ number: 1 }), 2: viewOf({ number: 2 }), 3: viewOf({ number: 3 }) };
  merges = [];
  portFor = ({ prNumber }) => portOf({ number: prNumber ?? 0 });
});

describe('merge in order', () => {
  it('merges the bottom part first, re-reading each part right before it merges', async () => {
    seed({ merged: 0 });

    const result = await run();

    expect(result).toEqual({ kind: 'done', merged: 3 });
    expect(order).toEqual(['read 1', 'merge 1', 'read 2', 'merge 2', 'read 3', 'merge 3']);
    expect(merges[0]).toEqual({
      number: 1,
      method: 'squash',
      mountId: MOUNTS[0],
      head: 'sha-1',
    });
  });

  it('skips a part that already merged', async () => {
    seed({ merged: 1 });

    const result = await run();

    expect(result).toEqual({ kind: 'done', merged: 2 });
    expect(order).toEqual(['read 2', 'merge 2', 'read 3', 'merge 3']);
  });

  it('stops at the first part that cannot merge and names the reason', async () => {
    seed({ merged: 0 });
    views[2] = viewOf({
      number: 2,
      overrides: {
        checks: {
          read: 'ok',
          error: null,
          runs: [
            { name: 'ledger tests', conclusion: 'failure', detailsUrl: null, durationMs: null },
          ],
        },
      },
    });

    const result = await run();

    expect(result).toEqual({
      kind: 'stopped',
      merged: 1,
      partLabel: '2',
      reason: 'part 2 has failing checks',
    });
    expect(order).toEqual(['read 1', 'merge 1', 'read 2']);
  });

  it.each([
    ['is closed', { state: 'closed' as const }],
    ['is still a draft', { isDraft: true }],
    ['has conflicts', { mergeable: false }],
    ['has changes requested', { reviewDecision: 'changes_requested' as const }],
  ])('stops for a part that %s', async (reason, overrides) => {
    seed({ merged: 0 });
    views[1] = viewOf({ number: 1, overrides });

    const result = await run();

    expect(result).toEqual({
      kind: 'stopped',
      merged: 0,
      partLabel: '1',
      reason: `part 1 ${reason}`,
    });
    expect(merges).toEqual([]);
  });

  it('stops with the host message when a merge is refused, and leaves later parts alone', async () => {
    seed({ merged: 0 });
    store.setState({
      mergePr: async (sessionId, number, method, options) => {
        if (number === 2) {
          throw new Error('405 Method Not Allowed');
        }
        await mergePr(sessionId, number, method, options);
      },
    });

    const result = await run();

    expect(result).toMatchObject({ kind: 'stopped', merged: 1, partLabel: '2' });
    expect(result.kind === 'stopped' ? result.reason : '').toContain('405 Method Not Allowed');
    expect(merges.map((merge) => merge.number)).toEqual([1]);
  });

  it('carries on from the first part still open when run again after a stop', async () => {
    seed({ merged: 1 });
    views[2] = viewOf({ number: 2, overrides: { mergeable: false } });
    const stopped = await run();
    expect(stopped).toMatchObject({ kind: 'stopped', merged: 0, partLabel: '2' });

    views[2] = viewOf({ number: 2 });
    const retried = await run();

    expect(retried).toEqual({ kind: 'done', merged: 2 });
  });

  it('stops when Goodboy has no way to reach the host of a part', async () => {
    seed({ merged: 0 });
    portFor = () => null;

    const result = await run();

    expect(result).toEqual({
      kind: 'stopped',
      merged: 0,
      partLabel: '1',
      reason: 'Goodboy cannot reach its host from here',
    });
  });

  it('does nothing for a series that is gone', async () => {
    seed({ merged: 0 });
    store.setState({ prSeries: {} });

    expect(await run()).toEqual({ kind: 'gone' });
    expect(order).toEqual([]);
  });
});
