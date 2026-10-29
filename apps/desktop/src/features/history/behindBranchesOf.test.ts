import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type IsoDateTime, type MountId, type SessionProjectMount } from '@goodboy/types';
import type { MountGithubState } from '../../store/types';
import { aProject, aSession } from '@goodboy/types/testing';
import { STORE_IMPORT_TIMEOUT_MS, importStore, type StoryStore } from '../../store/storyHarness';

const { statuses } = vi.hoisted(() => ({
  statuses: new Map<string, unknown>(),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../store/runtime/worktreeStatuses/cache', () => ({
  readWorktreeStatus: (key: string) => statuses.get(key) ?? null,
  worktreeStatusKey: ({ worktreePath }: { readonly worktreePath: string }) => worktreePath,
}));

const SESSION = aSession();
const PROJECT = aProject({ workspaceId: SESSION.workspaceId, name: 'ledger-core' });
const MERGED = brandId<MountId>({ value: 'mount-merged' });
const CLOSED = brandId<MountId>({ value: 'mount-closed' });
const OPEN = brandId<MountId>({ value: 'mount-open' });

type MountParams = {
  readonly id: MountId;
  readonly path: string;
};

const mountOf = ({ id, path }: MountParams): SessionProjectMount => ({
  mountId: id,
  sessionId: SESSION.id,
  projectId: PROJECT.id,
  mountName: 'ledger-core',
  worktreePath: path,
  lastWorktreePath: null,
  repoRoot: '/repos/ledger-core',
  branch: `ak/${id}`,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

type PullRequestParams = {
  readonly mountId: MountId;
  readonly number: number;
  readonly state: 'merged' | 'closed' | 'open';
};

const NOW = brandId<IsoDateTime>({ value: '2026-10-05T09:00:00.000Z' });

const githubOf = ({ mountId, number, state }: PullRequestParams): MountGithubState => {
  const pr = {
    number,
    title: 'Ledger',
    url: `https://github.com/acme/ledger-core/pull/${number}`,
    state,
    mergeable: true,
    checks: 'success',
    baseBranch: 'main',
    headBranch: `ak/${mountId}`,
    isDraft: false,
    reviewDecision: 'approved',
    body: '',
    updatedAt: NOW,
    headSha: `sha-${mountId}`,
  } satisfies NonNullable<MountGithubState['pr']>;
  return {
    mountId,
    projectId: PROJECT.id,
    revision: 1,
    repository: 'acme/ledger-core',
    host: 'github.com',
    branch: pr.headBranch,
    prs: [pr],
    links: [],
    pr,
    linkedIssues: [],
    fetchedAt: NOW,
    failedAt: null,
    loading: false,
    error: null,
    detail: null,
    detailFetchedAt: null,
    detailLoading: false,
    detailError: null,
  };
};

let store: StoryStore;
let behindBranchesOf: typeof import('./behindBranchesOf').behindBranchesOf;

beforeAll(async () => {
  store = await importStore();
  ({ behindBranchesOf } = await import('./behindBranchesOf'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(() => {
  statuses.clear();
  store.setState({
    projects: [PROJECT],
    sessionProjectMounts: {
      [SESSION.id]: [
        mountOf({ id: MERGED, path: '/wt/merged' }),
        mountOf({ id: CLOSED, path: '/wt/closed' }),
        mountOf({ id: OPEN, path: '/wt/open' }),
      ],
    },
    mountGithub: {
      [MERGED]: githubOf({ mountId: MERGED, number: 1, state: 'merged' }),
      [CLOSED]: githubOf({ mountId: CLOSED, number: 2, state: 'closed' }),
      [OPEN]: githubOf({ mountId: OPEN, number: 3, state: 'open' }),
    },
  });
});

describe('behindBranchesOf', () => {
  it('skips a merged branch and keeps a closed unmerged one that fell behind', () => {
    for (const path of ['/wt/merged', '/wt/closed', '/wt/open']) {
      statuses.set(path, {
        mainDistance: { kind: 'known', ahead: 1, behind: 3 },
        inProgress: null,
      });
    }

    const found = behindBranchesOf({ state: store.getState(), sessionId: SESSION.id });

    expect(found.map((branch) => branch.mountId)).toEqual([CLOSED, OPEN]);
  });
});
