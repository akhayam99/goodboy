// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { brandId, type IsoDateTime, type MountId, type PullRequestState } from '@goodboy/types';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import type { MountGithubState } from '../../../../../store/types';
import {
  mountFixture,
  SESSION,
  sessionFixture,
} from '../../../../../__tests__/helpers/actionFixtures';
import { aMountRow, aRequest } from '../testing/aMountRow';
import { branchFactsOf } from '../branchFactsOf';
import { useBranchDetails } from './index';

const START = Date.parse('2026-10-20T09:00:00.000Z');
const MOUNT = brandId<MountId>({ value: 'mount-payments' });
const PR_NUMBER = 309;
const COMMENTS_PATH = `repos/harborline/payments-api/issues/${PR_NUMBER}/comments`;

let store: StoryStore;
let detailFetches = 0;

const isoAt = ({ ms }: { readonly ms: number }): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(ms).toISOString() });

const PR: PullRequestState = {
  number: PR_NUMBER,
  title: 'Per-tenant limits on payouts',
  url: 'https://example.invalid/harborline/payments-api/pull/309',
  headSha: 'a41c9e2b7d3f',
  headBranch: 'hl/payout-export',
  baseBranch: 'main',
  checks: 'failure',
  state: 'open',
  isDraft: false,
  mergeable: true,
  reviewDecision: null,
  body: '',
  updatedAt: isoAt({ ms: START }),
};

type GithubParams = {
  readonly fetchedAt: number;
  readonly detailFetchedAt: number | null;
};

const githubOf = ({ fetchedAt, detailFetchedAt }: GithubParams): MountGithubState => ({
  mountId: MOUNT,
  projectId: mountFixture().projectId,
  revision: 1,
  repository: 'harborline/payments-api',
  host: 'github.com',
  branch: 'hl/payout-export',
  prs: [PR],
  links: [],
  pr: PR,
  linkedIssues: [],
  fetchedAt: isoAt({ ms: fetchedAt }),
  failedAt: null,
  loading: false,
  error: null,
  detail:
    detailFetchedAt === null
      ? null
      : { prNumber: PR_NUMBER, comments: [], reviews: [], reviewRequests: [], checks: [] },
  detailFetchedAt: detailFetchedAt === null ? null : isoAt({ ms: detailFetchedAt }),
  detailLoading: false,
  detailError: null,
});

const factsAt = ({ now }: { readonly now: number }) => {
  const row = {
    ...aMountRow({
      key: 'payments',
      projectName: 'payments-api',
      branch: 'hl/payout-export',
      request: aRequest({ provider: 'github', number: PR_NUMBER, checks: 'failure' }),
    }),
    mountId: MOUNT,
  };
  return branchFactsOf({
    rows: [row],
    fetchedAtByMountId: new Map([[MOUNT, new Date(now).toISOString()]]),
    behindByMountId: new Map(),
    liveCountByMountId: new Map(),
    now,
  });
};

const settle = async (): Promise<void> => {
  await act(async () => {
    for (let tick = 0; tick < 10; tick += 1) {
      await Promise.resolve();
    }
  });
};

const pollAt = async ({ ms }: { readonly ms: number }): Promise<void> => {
  vi.setSystemTime(ms);
  act(() => {
    store.setState((state) => {
      const current = state.mountGithub[MOUNT];
      if (current === undefined) {
        return state;
      }
      return {
        mountGithub: { ...state.mountGithub, [MOUNT]: { ...current, fetchedAt: isoAt({ ms }) } },
      };
    });
  });
  await settle();
};

type SeedParams = {
  readonly detailFetchedAt: number | null;
};

const seed = ({ detailFetchedAt }: SeedParams): void => {
  store.setState({
    sessions: [sessionFixture()],
    sessionProjectMounts: { [SESSION]: [mountFixture({ mountId: MOUNT })] },
    mountGithub: { [MOUNT]: githubOf({ fetchedAt: START, detailFetchedAt }) },
  });
};

const show = () =>
  renderHook(() => useBranchDetails({ sessionId: SESSION, facts: factsAt({ now: Date.now() }) }));

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
  detailFetches = 0;
  stubStoryInvoke({
    gh_run: ({ args }: { readonly args: ReadonlyArray<string> }) => {
      if (args.includes(COMMENTS_PATH)) {
        detailFetches += 1;
      }
      return { stdout: '', stderr: 'HTTP 403: Resource not accessible', exitCode: 1 };
    },
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useBranchDetails', () => {
  it('waits out the backoff after a failed detail fetch instead of asking again', async () => {
    seed({ detailFetchedAt: null });
    show();
    await settle();
    expect(detailFetches).toBe(1);
    expect(store.getState().mountGithub[MOUNT]?.detailLoading).toBe(false);
    expect(store.getState().mountDetailFailures[MOUNT]?.revision).toBe(1);

    await pollAt({ ms: START + 30_000 });
    expect(detailFetches).toBe(1);

    await pollAt({ ms: START + 61_000 });
    expect(detailFetches).toBe(2);
  });

  it('keeps a fresh detail for its time to live', async () => {
    seed({ detailFetchedAt: START });
    show();
    await settle();
    expect(detailFetches).toBe(0);

    await pollAt({ ms: START + 20_000 });
    expect(detailFetches).toBe(0);

    await pollAt({ ms: START + 31_000 });
    expect(detailFetches).toBe(1);
  });

  it('asks again at once when the mount moves to a new revision', async () => {
    seed({ detailFetchedAt: null });
    show();
    await settle();
    expect(detailFetches).toBe(1);

    act(() => {
      store.setState({
        sessionProjectMounts: { [SESSION]: [mountFixture({ mountId: MOUNT, revision: 2 })] },
      });
    });
    await pollAt({ ms: START + 5_000 });
    expect(detailFetches).toBe(2);
  });

  it('drops a failure that lands after the mount moved on', async () => {
    seed({ detailFetchedAt: null });
    stubStoryInvoke({
      gh_run: ({ args }: { readonly args: ReadonlyArray<string> }) => {
        if (args.includes(COMMENTS_PATH)) {
          detailFetches += 1;
          store.setState({
            sessionProjectMounts: { [SESSION]: [mountFixture({ mountId: MOUNT, revision: 2 })] },
          });
        }
        return { stdout: '', stderr: 'HTTP 403: Resource not accessible', exitCode: 1 };
      },
    });
    show();
    await settle();
    expect(detailFetches).toBe(1);
    expect(store.getState().mountDetailFailures[MOUNT]).toBeUndefined();
  });
});
