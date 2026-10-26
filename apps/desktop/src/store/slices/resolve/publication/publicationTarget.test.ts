// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  PullRequestState,
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
  type StoryStore,
} from '../../../storyHarness';
import type { MountGithubState } from '../../../types';
import { publicationTarget } from './publicationTarget';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const PROJECT_LEDGER = brandId<ProjectId>({ value: 'project-ledger-core' });
const PROJECT_PAYMENTS = brandId<ProjectId>({ value: 'project-payments-api' });
const MOUNT_LEDGER = brandId<MountId>({ value: 'mount-ledger-core' });
const MOUNT_PAYMENTS = brandId<MountId>({ value: 'mount-payments-api' });
const STAMP = brandId<IsoDateTime>({ value: '2026-10-07T08:00:00.000Z' });

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

const githubOf = ({
  mount,
  name,
  number,
}: {
  readonly mount: SessionProjectMount;
  readonly name: string;
  readonly number: number;
}): MountGithubState => {
  const pr: PullRequestState = {
    number,
    title: `Tidy ${name}`,
    url: `https://github.com/harborline/${name}/pull/${number}`,
    state: 'open',
    mergeable: true,
    checks: 'success',
    baseBranch: 'main',
    headBranch: mount.branch,
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: STAMP,
  };
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

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
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
    sessionActiveProject: { [SESSION_ID]: PROJECT_LEDGER },
    mountGithub: {
      [MOUNT_LEDGER]: githubOf({ mount: LEDGER, name: 'ledger-core', number: 12 }),
      [MOUNT_PAYMENTS]: githubOf({ mount: PAYMENTS, name: 'payments-api', number: 12 }),
    },
  });
});

describe('publicationTarget', () => {
  it('names the request of the mount the push was asked for', () => {
    const target = publicationTarget({
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      mountId: MOUNT_PAYMENTS,
    });

    expect(target.repo).toBe('harborline/payments-api');
    expect(target.prUrl).toBe('https://github.com/harborline/payments-api/pull/12');
  });

  it('falls back to the write destination when no mount is named', () => {
    const target = publicationTarget({
      get: useAppStore.getState,
      sessionId: SESSION_ID,
      mountId: null,
    });

    expect(target.repo).toBe('harborline/ledger-core');
  });
});
