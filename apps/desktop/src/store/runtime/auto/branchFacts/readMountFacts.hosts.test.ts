// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { composeBranchFacts } from '@goodboy/core';
import { brandId, type MountId, type WorkspaceId } from '@goodboy/types';
import { aProject, TEST_NOW } from '@goodboy/types/testing';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../storyHarness')).dbModuleMock({
    findPrSeriesMembership: vi.fn(async () => null),
    listMountPullRequestLinks: vi.fn(async () => []),
    setResolveThreadSourceSnapshot: vi.fn(async () => undefined),
  }),
);

import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../storyHarness';
import type {
  BitbucketComment,
  BitbucketPullRequest,
  BitbucketRepo,
  BitbucketStatus,
} from '../../../../features/integrations/bitbucket/client';
import type {
  GitlabMrDiscussion,
  GitlabMrNote,
} from '../../../../features/integrations/gitlab/client';
import { gitlabMrFixture } from '../../../slices/gitlab-mr/testing/gitlabMrFixture';
import type { MountBitbucketPrState } from '../../../slices/bitbucket-pr/state';
import { makeBranchFactsReaders } from '../makeBranchFactsReaders';
import { readBranchFactsOf } from './readBranchFactsOf';

const { session, ledger, ledgerMount, makeMr, mountState } = gitlabMrFixture;

let useAppStore: StoryStore;

const BITBUCKET_REPO: BitbucketRepo = {
  workspaceId: brandId<WorkspaceId>({ value: session.workspaceId }),
  workspaceSlug: 'acme',
  repoSlug: 'ledger-core',
  email: 'nadia@acme.test',
};

const bitbucketPrOf = ({ id }: { readonly id: number }): BitbucketPullRequest => ({
  id,
  title: `Acme change ${id}`,
  description: '',
  state: 'OPEN',
  createdOn: TEST_NOW,
  updatedOn: TEST_NOW,
  sourceBranch: 'ak/ledger-core',
  sourceCommit: '6c20f48a9e1',
  destinationBranch: 'main',
  destinationCommit: null,
  author: null,
  reviewers: [],
  participants: [],
  closeSourceBranch: false,
  mergeCommit: null,
  commentCount: 0,
  taskCount: 0,
  webUrl: `https://bitbucket.org/acme/ledger-core/pull-requests/${id}`,
});

type BitbucketEntryParams = {
  readonly pr: BitbucketPullRequest | null;
  readonly patch?: Partial<MountBitbucketPrState>;
};

const bitbucketEntryOf = ({ pr, patch = {} }: BitbucketEntryParams): MountBitbucketPrState => ({
  mountId: ledgerMount,
  projectId: ledger.id,
  revision: 1,
  host: 'bitbucket.org',
  repo: BITBUCKET_REPO,
  repository: 'acme/ledger-core',
  branch: 'ak/ledger-core',
  prs: pr === null ? [] : [pr],
  links: [],
  checks: null,
  reviewDecision: null,
  pr,
  fetchedAt: TEST_NOW,
  loading: false,
  error: null,
  ...patch,
});

type GitlabNoteParams = {
  readonly id: number;
  readonly body: string;
  readonly isResolved: boolean;
};

const gitlabNoteOf = ({ id, body, isResolved }: GitlabNoteParams): GitlabMrNote => ({
  id,
  body,
  system: false,
  author: { username: 'northwind-dev', name: 'Northwind Dev', avatarUrl: null },
  createdAt: TEST_NOW,
  resolvable: true,
  resolved: isResolved,
  position: {
    newPath: 'src/export.ts',
    oldPath: null,
    newLine: 12,
    oldLine: null,
  },
});

const gitlabDiscussionOf = ({ id, body, isResolved }: GitlabNoteParams): GitlabMrDiscussion => ({
  id: `discussion-${id}`,
  individualNote: false,
  notes: [gitlabNoteOf({ id, body, isResolved })],
});

type BitbucketCommentParams = {
  readonly id: number;
  readonly body: string;
  readonly isDeleted?: boolean;
  readonly isInline?: boolean;
};

const bitbucketCommentOf = ({
  id,
  body,
  isDeleted = false,
  isInline = true,
}: BitbucketCommentParams): BitbucketComment => ({
  id,
  body,
  user: null,
  createdOn: TEST_NOW,
  updatedOn: TEST_NOW,
  deleted: isDeleted,
  parentId: null,
  inline: isInline ? { path: 'src/export.ts', from: null, to: 12 } : null,
  webUrl: `https://bitbucket.org/acme/ledger-core/pull-requests/12#comment-${id}`,
});

const bitbucketStatusOf = ({ name }: { readonly name: string }): BitbucketStatus => ({
  key: name,
  name,
  state: 'SUCCESSFUL',
  url: null,
  description: null,
  refname: null,
  createdOn: TEST_NOW,
  updatedOn: TEST_NOW,
});

type FailingParams = {
  readonly message: string;
};

type HostParams = {
  readonly overrides?: Readonly<Record<string, unknown>>;
};

const failing = ({ message }: FailingParams) => {
  return () => {
    throw message;
  };
};

const gitlabHost = ({ overrides = {} }: HostParams) =>
  stubStoryInvoke({
    gitlab_get_mr: makeMr({ iid: 57, name: 'ledger-core' }),
    gitlab_mr_approval_state: null,
    gitlab_mr_commits: [],
    gitlab_mr_diff: '',
    gitlab_project_merge_methods: {
      mergeMethod: 'merge',
      squashOption: 'default_off',
      onlyAllowMergeIfPipelineSucceeds: false,
    },
    gitlab_mr_pipeline_jobs: {
      pipeline: { id: 1, status: 'success' },
      jobs: [
        { id: 1, name: 'ci-57', status: 'success', webUrl: null, allowFailure: false, duration: 3 },
      ],
    },
    gitlab_list_mr_discussions: [],
    ...overrides,
  });

const bitbucketHost = ({ overrides = {} }: HostParams) =>
  stubStoryInvoke({
    bitbucket_get_pull_request: bitbucketPrOf({ id: 12 }),
    bitbucket_list_pull_request_statuses: [bitbucketStatusOf({ name: 'ci-12' })],
    bitbucket_list_pull_request_commits: [],
    bitbucket_pull_request_diff: '',
    bitbucket_list_pull_request_comments: [],
    ...overrides,
  });

const briefOf = async (): Promise<string> => {
  const readers = makeBranchFactsReaders({
    getState: useAppStore.getState,
    commitRange: vi.fn(async () => [{ sha: 'abc123def', subject: 'feat: export the ledger' }]),
  });
  const parts = await readBranchFactsOf({
    readers,
    params: {
      sessionId: session.id,
      mountId: brandId<MountId>({ value: ledgerMount }),
      worktreePath: '/worktrees/ledger-core',
      branch: 'ak/ledger-core',
    },
  });
  return composeBranchFacts({ facts: [{ mountLabel: 'ledger-core', ...parts }] }) ?? '';
};

type SeedParams = {
  readonly remoteUrl: string;
};

const seed = ({ remoteUrl }: SeedParams) =>
  useAppStore.setState({
    ...gitlabMrFixture.seedState(),
    projects: [
      aProject({ id: ledger.id, workspaceId: ledger.workspaceId, name: 'ledger-core', remoteUrl }),
    ],
    mountGitlabMr: {},
    mountBitbucketPr: {},
    refreshSessionPr: vi.fn(async () => undefined),
    refreshSessionPrDetail: vi.fn(async () => undefined),
    refreshSessionMr: vi.fn(async () => undefined),
    refreshSessionBitbucketPr: vi.fn(async () => undefined),
  });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('the branch facts of a GitLab mount', () => {
  beforeEach(() => {
    seed({ remoteUrl: 'git@gitlab.com:acme/ledger-core.git' });
    useAppStore.setState({
      mountGitlabMr: {
        [ledgerMount]: mountState({
          mountId: ledgerMount,
          projectId: ledger.id,
          name: 'ledger-core',
          mr: makeMr({ iid: 57, name: 'ledger-core' }),
        }),
      },
    });
  });

  it('names the merge request and its checks from the store entry', async () => {
    gitlabHost({});
    const brief = await briefOf();
    expect(brief).toContain('Merge request: 57');
    expect(brief).toContain('Harborline change 57');
    expect(brief).toContain('merge_requests/57');
    expect(brief).toContain('ci-57: success');
  });

  it('lists the unresolved threads and leaves the resolved ones out', async () => {
    gitlabHost({
      overrides: {
        gitlab_list_mr_discussions: [
          gitlabDiscussionOf({ id: 1, body: 'rename it', isResolved: false }),
          gitlabDiscussionOf({ id: 2, body: 'already fixed', isResolved: true }),
          gitlabDiscussionOf({ id: 3, body: 'why', isResolved: false }),
        ],
      },
    });
    const brief = await briefOf();
    expect(brief).toContain('Open review threads: 2');
    expect(brief).toContain('rename it');
    expect(brief).toContain('why');
    expect(brief).not.toContain('already fixed');
  });

  it('says unknown when the mount has no entry, never none', async () => {
    gitlabHost({});
    useAppStore.setState({ mountGitlabMr: {} });
    const brief = await briefOf();
    expect(brief).toContain('Pull request: Facts not available');
    expect(brief).not.toContain('none is open');
  });

  it('says unknown for the threads when the discussions cannot be read', async () => {
    gitlabHost({
      overrides: { gitlab_list_mr_discussions: failing({ message: 'rate limited' }) },
    });
    const brief = await briefOf();
    expect(brief).toContain('Merge request: 57');
    expect(brief).toContain('Review threads: Facts not available: rate limited');
    expect(brief).not.toContain('Open review threads: 0');
  });

  it('says unknown when the merge request cannot be read', async () => {
    gitlabHost({ overrides: { gitlab_get_mr: failing({ message: 'rate limited' }) } });
    const brief = await briefOf();
    expect(brief).toContain('Pull request: Facts not available');
    expect(brief).toContain('rate limited');
    expect(brief).not.toContain('Merge request: 57');
  });
});

describe('the branch facts of a Bitbucket mount', () => {
  beforeEach(() => {
    seed({ remoteUrl: 'git@bitbucket.org:acme/ledger-core.git' });
    useAppStore.setState({
      mountBitbucketPr: { [ledgerMount]: bitbucketEntryOf({ pr: bitbucketPrOf({ id: 12 }) }) },
    });
  });

  it('names the pull request and its checks from the store entry', async () => {
    bitbucketHost({});
    const brief = await briefOf();
    expect(brief).toContain('Pull request: 12');
    expect(brief).toContain('Acme change 12');
    expect(brief).toContain('pull-requests/12');
    expect(brief).toContain('ci-12: success');
  });

  it('lists the live inline threads and leaves the deleted and general ones out', async () => {
    bitbucketHost({
      overrides: {
        bitbucket_list_pull_request_comments: [
          bitbucketCommentOf({ id: 1, body: 'rename it' }),
          bitbucketCommentOf({ id: 2, body: 'withdrawn remark', isDeleted: true }),
          bitbucketCommentOf({ id: 3, body: 'thanks all', isInline: false }),
          bitbucketCommentOf({ id: 4, body: 'why' }),
        ],
      },
    });
    const brief = await briefOf();
    expect(brief).toContain('Open review threads: 2');
    expect(brief).toContain('rename it');
    expect(brief).toContain('why');
    expect(brief).not.toContain('withdrawn remark');
    expect(brief).not.toContain('thanks all');
  });

  it('says unknown when the mount has no entry, never none', async () => {
    bitbucketHost({});
    useAppStore.setState({ mountBitbucketPr: {} });
    const brief = await briefOf();
    expect(brief).toContain('Pull request: Facts not available');
    expect(brief).not.toContain('none is open');
  });

  it('says unknown when the host failed and nothing is known, never none', async () => {
    bitbucketHost({});
    useAppStore.setState({
      mountBitbucketPr: {
        [ledgerMount]: bitbucketEntryOf({
          pr: null,
          patch: { fetchedAt: null, error: 'the host answered 502' },
        }),
      },
    });
    const brief = await briefOf();
    expect(brief).toContain('Pull request: Facts not available: the host answered 502');
    expect(brief).not.toContain('none is open');
  });

  it('says unknown for the threads when the comments cannot be read', async () => {
    bitbucketHost({
      overrides: { bitbucket_list_pull_request_comments: failing({ message: 'rate limited' }) },
    });
    const brief = await briefOf();
    expect(brief).toContain('Pull request: 12');
    expect(brief).toContain('Review threads: Facts not available');
    expect(brief).not.toContain('Open review threads: 0');
  });
});
