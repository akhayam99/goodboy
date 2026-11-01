// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  PullRequestState,
  PullRequestView,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { MountGithubState } from '../../../../store/types';
import { withPullRequestViewEntry } from '../../../../store/slices/pull-request-view/pullRequestViewAt';
import { usePullRequestReadiness } from './index';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger' });
const PROJECT_LEDGER = brandId<ProjectId>({ value: 'project-ledger-core' });
const PROJECT_PAYMENTS = brandId<ProjectId>({ value: 'project-payments-api' });
const MOUNT_LEDGER = brandId<MountId>({ value: 'mount-ledger-core' });
const MOUNT_PAYMENTS = brandId<MountId>({ value: 'mount-payments-api' });
const STAMP = brandId<IsoDateTime>({ value: '2026-10-07T08:00:00.000Z' });
const SAME_NUMBER = 12;

const mountOf = ({
  mountId,
  projectId,
  name,
  parallelIndex,
}: {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly parallelIndex: number;
}): SessionProjectMount => ({
  mountId,
  sessionId: SESSION_ID,
  projectId,
  mountName: name,
  worktreePath: `/worktrees/${name}`,
  lastWorktreePath: `/worktrees/${name}`,
  repoRoot: `/repos/${name}`,
  branch: `hl/${name}`,
  baseBranch: null,
  parallelIndex,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const prOf = ({ name }: { readonly name: string }): PullRequestState => ({
  number: SAME_NUMBER,
  title: `Tidy ${name}`,
  url: `https://github.com/harborline/${name}/pull/${SAME_NUMBER}`,
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: `hl/${name}`,
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: STAMP,
});

const githubOf = ({
  mount,
  name,
}: {
  readonly mount: SessionProjectMount;
  readonly name: string;
}): MountGithubState => {
  const pr = prOf({ name });
  return {
    mountId: mount.mountId,
    projectId: mount.projectId,
    revision: 1,
    repository: `harborline/${name}`,
    host: 'github.com',
    branch: mount.branch,
    prs: [pr],
    links: [],
    pr,
    linkedIssues: [],
    fetchedAt: STAMP,
    failedAt: null,
    loading: false,
    error: null,
    detail: null,
    detailFetchedAt: null,
    detailLoading: false,
    detailError: null,
  };
};

const viewOf = ({
  name,
  mergeMethods,
}: {
  readonly name: string;
  readonly mergeMethods: PullRequestView['mergeMethods'];
}): PullRequestView => ({
  host: 'github',
  number: SAME_NUMBER,
  title: `Tidy ${name}`,
  body: '',
  url: `https://github.com/harborline/${name}/pull/${SAME_NUMBER}`,
  state: 'open',
  isDraft: false,
  author: null,
  baseBranch: 'main',
  headBranch: `hl/${name}`,
  headSha: null,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-06T10:00:00Z',
  mergedAt: null,
  mergeable: true,
  reviewDecision: null,
  reviewers: [],
  resolves: [],
  checks: { read: 'ok', error: null, runs: [] },
  files: { count: 0, first: [] },
  commits: [],
  mergeMethods,
  mergeMethodReasons: {},
});

const entryOf = ({
  mountId,
  view,
}: {
  readonly mountId: MountId;
  readonly view: PullRequestView;
}) =>
  withPullRequestViewEntry({
    views: {},
    sessionId: SESSION_ID,
    entry: {
      prNumber: SAME_NUMBER,
      mountId,
      view,
      isLoading: false,
      error: null,
      fetchedAt: STAMP,
      edits: [],
    },
  })[SESSION_ID] ?? {};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const LEDGER = mountOf({
  mountId: MOUNT_LEDGER,
  projectId: PROJECT_LEDGER,
  name: 'ledger-core',
  parallelIndex: 0,
});
const PAYMENTS = mountOf({
  mountId: MOUNT_PAYMENTS,
  projectId: PROJECT_PAYMENTS,
  name: 'payments-api',
  parallelIndex: 1,
});

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [] });
  useAppStore.setState({
    sessions: [
      aSession({
        id: SESSION_ID,
        workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
      }),
    ],
    projects: [
      aProject({ id: PROJECT_LEDGER, name: 'ledger-core' }),
      aProject({ id: PROJECT_PAYMENTS, name: 'payments-api' }),
    ],
    sessionProjectMounts: { [SESSION_ID]: [LEDGER, PAYMENTS] },
    sessionActiveMount: { [SESSION_ID]: MOUNT_LEDGER },
    mountGithub: {
      [MOUNT_LEDGER]: githubOf({ mount: LEDGER, name: 'ledger-core' }),
      [MOUNT_PAYMENTS]: githubOf({ mount: PAYMENTS, name: 'payments-api' }),
    },
    pullRequestViews: {
      [SESSION_ID]: {
        ...entryOf({
          mountId: MOUNT_LEDGER,
          view: viewOf({ name: 'ledger-core', mergeMethods: ['merge'] }),
        }),
        ...entryOf({
          mountId: MOUNT_PAYMENTS,
          view: viewOf({ name: 'payments-api', mergeMethods: ['squash'] }),
        }),
      },
    },
  });
});

afterEach(cleanup);

const readinessOf = ({ mountId }: { readonly mountId: MountId }) =>
  renderHook(() =>
    usePullRequestReadiness({ sessionId: SESSION_ID, mountId, isRebaseStopOpen: false }),
  );

describe('usePullRequestReadiness with the same request number in two repositories', () => {
  it('reads the merge methods of the mount on screen, not of the one chat writes to', () => {
    expect(readinessOf({ mountId: MOUNT_PAYMENTS }).result.current.facts.mergeMethods).toEqual([
      'squash',
    ]);
    expect(readinessOf({ mountId: MOUNT_LEDGER }).result.current.facts.mergeMethods).toEqual([
      'merge',
    ]);
  });

  it('never borrows the view of the other mount while its own has not arrived', () => {
    useAppStore.setState({
      pullRequestViews: {
        [SESSION_ID]: entryOf({
          mountId: MOUNT_LEDGER,
          view: viewOf({ name: 'ledger-core', mergeMethods: ['merge'] }),
        }),
      },
    });

    const merge = readinessOf({ mountId: MOUNT_PAYMENTS }).result.current.facts.mergeMethods;

    expect(merge).not.toEqual(['merge']);
  });
});
