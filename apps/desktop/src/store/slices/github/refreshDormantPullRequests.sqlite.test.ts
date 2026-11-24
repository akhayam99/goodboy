import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  archiveSession,
  getPullRequestOutcomes,
  insertSession,
  insertSessionMount,
  insertWorkspace,
  upsertMountPullRequestLink,
} from '@goodboy/db';
import { brandId, type MountId, type SessionId, type WorkspaceId } from '@goodboy/types';
import { aSession, TEST_NOW } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const REPOSITORY = 'acme/ledger-core';
const MERGED_AT = '2026-07-27T09:00:00.000Z';

type WorkParams = {
  readonly key: string;
  readonly number: number;
  readonly isAttached: boolean;
  readonly isArchived: boolean;
};

const seedWork = async ({ key, number, isAttached, isArchived }: WorkParams) => {
  const db = storySqlite();
  const sessionId = brandId<SessionId>({ value: `session-${key}` });
  const mountId = brandId<MountId>({ value: `mount-${key}` });
  await insertSession(db, aSession({ id: sessionId, workspaceId: WORKSPACE_ID }));
  await insertSessionMount({
    db,
    mount: {
      id: mountId,
      sessionId,
      projectId: null,
      worktreePath: isAttached ? `/tmp/ledger-core/${key}` : null,
      lastWorktreePath: null,
      branch: `northwind/${key}`,
      baseBranch: 'main',
      parallelIndex: 0,
      mountName: 'ledger-core',
      repoSlug: REPOSITORY,
      isAttached,
      diskState: isAttached ? 'present' : 'removed',
      revision: 1,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    },
  });
  await upsertMountPullRequestLink({
    db,
    sessionId,
    link: {
      id: `link-${key}`,
      mountId,
      provider: 'github',
      host: 'github.com',
      repoSlug: REPOSITORY,
      prNumber: number,
      headBranch: `northwind/${key}`,
      baseBranch: 'main',
      url: `https://github.com/${REPOSITORY}/pull/${number}`,
      state: 'open',
      snapshot: null,
      mergedHeadSha: null,
      mergedAt: null,
      lastObservedAt: TEST_NOW,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    },
  });
  if (isArchived) {
    await archiveSession(db, sessionId);
  }
};

const NUMBER_BY_BRANCH: Readonly<Record<string, number>> = {
  'northwind/detached': 11,
  'northwind/archived': 12,
};

type GhRunArgs = { readonly args: ReadonlyArray<string> };

const mergedNode = ({ branch }: { readonly branch: string }) => ({
  number: NUMBER_BY_BRANCH[branch],
  title: `Ship ${branch}`,
  url: `https://github.com/${REPOSITORY}/pull/${NUMBER_BY_BRANCH[branch]}`,
  state: 'MERGED',
  isDraft: false,
  mergeable: 'UNKNOWN',
  baseRefName: 'main',
  headRefName: branch,
  reviewDecision: null,
  updatedAt: MERGED_AT,
  body: '',
  autoMergeRequest: null,
  headRefOid: 'abc123',
  mergedAt: MERGED_AT,
  author: null,
  reviewRequests: { totalCount: 0 },
  isInMergeQueue: false,
  mergeQueueEntry: null,
  commits: null,
});

const answerBatch = ({ args }: GhRunArgs) => {
  const repository: Record<string, { readonly nodes: ReadonlyArray<unknown> }> = {};
  for (const arg of args) {
    const match = /^(b\d+)=(.+)$/.exec(arg);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      const isListed = NUMBER_BY_BRANCH[match[2]] !== undefined;
      repository[match[1]] = { nodes: isListed ? [mergedNode({ branch: match[2] })] : [] };
    }
  }
  return { stdout: JSON.stringify({ data: { repository } }), stderr: '', exitCode: 0 };
};

const BURIED_BRANCH = 'northwind/buried';

const answerView = () => ({
  stdout: JSON.stringify({
    ...mergedNode({ branch: BURIED_BRANCH }),
    number: 13,
    url: `https://github.com/${REPOSITORY}/pull/13`,
    statusCheckRollup: [],
  }),
  stderr: '',
  exitCode: 0,
});

const answerHost = ({ args }: GhRunArgs) =>
  args.includes('view') ? answerView() : answerBatch({ args });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: buildStoryWorkspace({ id: WORKSPACE_ID }) });
  stubStoryInvoke({ gh_run: (input: GhRunArgs) => answerHost(input) });
  useAppStore.setState({ githubStatus: { mode: 'pat', available: true } });
});

describe('Impact settles pull requests no live mount watches', () => {
  it('asks the host once per repository and counts the merges of detached and archived work', async () => {
    await seedWork({ key: 'detached', number: 11, isAttached: false, isArchived: false });
    await seedWork({ key: 'archived', number: 12, isAttached: true, isArchived: true });

    const settled = await useAppStore.getState().refreshDormantPullRequests(WORKSPACE_ID);

    const hostCalls = storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'gh_run');
    expect(hostCalls).toHaveLength(1);
    expect(settled).toBe(2);
    const outcomes = await getPullRequestOutcomes({
      db: storySqlite(),
      workspaceId: WORKSPACE_ID,
      sinceMs: null,
    });
    expect(outcomes).toMatchObject({ open: 0, merged: 2 });
  });

  it('asks for a pull request by number when its branch page leaves it out', async () => {
    await seedWork({ key: 'buried', number: 13, isAttached: false, isArchived: false });

    const settled = await useAppStore.getState().refreshDormantPullRequests(WORKSPACE_ID);

    const viewCalls = storySpies.tauriInvoke.mock.calls.filter(
      ([command, input]) => command === 'gh_run' && JSON.stringify(input).includes('"view"'),
    );
    expect(viewCalls).toHaveLength(1);
    expect(settled).toBe(1);
    const outcomes = await getPullRequestOutcomes({
      db: storySqlite(),
      workspaceId: WORKSPACE_ID,
      sinceMs: null,
    });
    expect(outcomes).toMatchObject({ open: 0, merged: 1 });
  });
});
