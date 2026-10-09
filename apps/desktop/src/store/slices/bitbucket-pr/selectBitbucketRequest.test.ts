// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  SessionId,
  SessionMountView,
  WorkspaceId,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import type { BitbucketPullRequest } from '../../../features/integrations/bitbucket/client';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { branchHasPullRequest, branchTabOf } from '../session-view/branchTabOf';
import { selectBitbucketRequest } from './selectBitbucketRequest';
import type { MountBitbucketPrState } from './state';

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_ID = 'project-payments-api' as ProjectId;
const FIRST = 'mount-first' as MountId;
const SECOND = 'mount-second' as MountId;
const STAMP = '2026-10-07T08:00:00.000Z' as IsoDateTime;
const REPO = {
  workspaceId: 'workspace-1' as WorkspaceId,
  workspaceSlug: 'harborline',
  repoSlug: 'payments-api',
  email: 'nadia@harborline.test',
};

const pr = (id: number, over: Partial<BitbucketPullRequest> = {}): BitbucketPullRequest => ({
  id,
  title: `Request ${id}`,
  description: '',
  state: 'OPEN',
  createdOn: STAMP,
  updatedOn: STAMP,
  sourceBranch: `hl/branch-${id}`,
  sourceCommit: null,
  destinationBranch: 'main',
  destinationCommit: null,
  author: null,
  reviewers: [],
  participants: [],
  closeSourceBranch: false,
  mergeCommit: null,
  commentCount: 0,
  taskCount: 0,
  webUrl: `https://bitbucket.org/harborline/payments-api/pull-requests/${id}`,
  ...over,
});

const entry = (
  mountId: MountId,
  over: Partial<MountBitbucketPrState> = {},
): MountBitbucketPrState => ({
  mountId,
  projectId: PROJECT_ID,
  revision: 1,
  host: 'bitbucket.org',
  repo: REPO,
  repository: 'harborline/payments-api',
  branch: 'hl/branch',
  prs: [],
  links: [],
  checks: null,
  reviewDecision: null,
  pr: null,
  fetchedAt: STAMP,
  loading: false,
  error: null,
  ...over,
});

const view = (id: MountId): SessionMountView => ({
  id,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  worktreePath: `/work/${id}`,
  lastWorktreePath: null,
  branch: 'hl/branch',
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: 'payments-api',
  repoSlug: null,
  repoRoot: '/repos/payments-api',
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: STAMP,
  updatedAt: STAMP,
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [aSession({ id: SESSION_ID, workspaceId: REPO.workspaceId })],
    projects: [aProject({ id: PROJECT_ID, name: 'payments-api' })],
    sessionMounts: { [SESSION_ID]: [view(FIRST), view(SECOND)] },
    sessionActiveMount: { [SESSION_ID]: FIRST },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
  });
});

const select = (extra: { readonly mountId?: MountId; readonly prNumber?: number } = {}) =>
  selectBitbucketRequest({ state: useAppStore.getState(), sessionId: SESSION_ID, ...extra });

describe('selectBitbucketRequest', () => {
  it('reads the request of the active mount with its repository', () => {
    useAppStore.setState({
      mountBitbucketPr: { [FIRST]: entry(FIRST, { pr: pr(42), prs: [pr(42)] }) },
    });

    expect(select()).toMatchObject({ mountId: FIRST, repo: REPO, pr: { id: 42 } });
  });

  it('falls back to a sibling mount when the active one has none', () => {
    useAppStore.setState({
      mountBitbucketPr: {
        [FIRST]: entry(FIRST),
        [SECOND]: entry(SECOND, { pr: pr(43), prs: [pr(43)] }),
      },
    });

    expect(select()?.mountId).toBe(SECOND);
  });

  it('asks a named mount and nothing else', () => {
    useAppStore.setState({
      mountBitbucketPr: {
        [FIRST]: entry(FIRST, { pr: pr(42), prs: [pr(42)] }),
        [SECOND]: entry(SECOND),
      },
    });

    expect(select({ mountId: SECOND })).toBeNull();
    expect(select({ mountId: FIRST })?.pr.id).toBe(42);
  });

  it('finds a request by number among the ones the mount holds', () => {
    useAppStore.setState({
      mountBitbucketPr: { [FIRST]: entry(FIRST, { pr: pr(42), prs: [pr(42), pr(44)] }) },
    });

    expect(select({ prNumber: 44 })?.pr.id).toBe(44);
    expect(select({ prNumber: 99 })).toBeNull();
  });

  it('keeps a declined request so its page still reads', () => {
    const declined = pr(42, { state: 'DECLINED' });
    useAppStore.setState({ mountBitbucketPr: { [FIRST]: entry(FIRST, { pr: declined }) } });

    expect(select()?.pr.state).toBe('DECLINED');
  });

  it('gives nothing without a bound repository', () => {
    useAppStore.setState({
      mountBitbucketPr: { [FIRST]: entry(FIRST, { repo: null, pr: pr(42), prs: [pr(42)] }) },
    });

    expect(select()).toBeNull();
  });
});

describe('the branch landing tab of a Bitbucket session', () => {
  it('lands on the Pull request tab once the request is known, and on Files before', () => {
    const tabNow = () =>
      branchTabOf({ state: useAppStore.getState(), sessionId: SESSION_ID, mountPath: null });

    expect(branchHasPullRequest({ state: useAppStore.getState(), sessionId: SESSION_ID })).toBe(
      false,
    );
    expect(tabNow()).toBe('files');

    useAppStore.setState({
      mountBitbucketPr: { [FIRST]: entry(FIRST, { pr: pr(42), prs: [pr(42)] }) },
    });

    expect(branchHasPullRequest({ state: useAppStore.getState(), sessionId: SESSION_ID })).toBe(
      true,
    );
    expect(tabNow()).toBe('pr');
  });

  it('keeps the tab the person chose', () => {
    useAppStore.setState({
      mountBitbucketPr: { [FIRST]: entry(FIRST, { pr: pr(42), prs: [pr(42)] }) },
      branchTab: { [SESSION_ID]: 'checks' },
    });

    expect(
      branchTabOf({ state: useAppStore.getState(), sessionId: SESSION_ID, mountPath: null }),
    ).toBe('checks');
  });
});
