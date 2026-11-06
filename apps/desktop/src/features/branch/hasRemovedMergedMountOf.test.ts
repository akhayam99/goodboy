// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { MountId, SessionMountView } from '@goodboy/types';
import { TEST_NOW, aSession } from '@goodboy/types/testing';
import type { AppState } from '../../store/types';
import type { BitbucketPullRequest } from '../integrations/bitbucket/client';
import { gitlabMrFixture } from '../../store/slices/mount-request/testing/gitlabMrFixture';
import type { MountBitbucketPrState } from '../../store/slices/mount-request/state';
import { hasRemovedMergedMountOf } from './hasRemovedMergedMountOf';

const { ledger, ledgerMount, relayMount, makeMr, mountState } = gitlabMrFixture;
const SESSION = aSession({});

type ViewParams = {
  readonly id: MountId;
  readonly isAttached: boolean;
};

const viewOf = ({ id, isAttached }: ViewParams): SessionMountView => ({
  id,
  sessionId: SESSION.id,
  projectId: ledger.id,
  mountName: 'ledger-core',
  worktreePath: isAttached ? `/worktrees/${id}` : null,
  lastWorktreePath: `/worktrees/${id}`,
  repoRoot: '/repos/ledger-core',
  branch: 'ak/ledger-core',
  baseBranch: null,
  parallelIndex: 0,
  repoSlug: null,
  isAttached,
  diskState: isAttached ? 'present' : 'removed',
  revision: 2,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
});

const BITBUCKET_PR: BitbucketPullRequest = {
  id: 11,
  title: 'Harborline change 11',
  description: '',
  state: 'MERGED',
  createdOn: '2026-09-01T10:00:00Z',
  updatedOn: '2026-09-01T11:00:00Z',
  sourceBranch: 'ak/ledger-core',
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
  webUrl: null,
};

const BITBUCKET: MountBitbucketPrState = {
  kind: 'bitbucket',
  mountId: ledgerMount,
  projectId: ledger.id,
  revision: 1,
  host: 'bitbucket.org',
  repo: null,
  repository: 'harborline/ledger-core',
  branch: 'ak/ledger-core',
  prs: [],
  links: [],
  checks: null,
  reviewDecision: null,
  pr: BITBUCKET_PR,
  selected: null,
  fetchedAt: TEST_NOW,
  failedAt: null,
  loading: false,
  error: null,
};

const GITLAB = mountState({
  mountId: ledgerMount,
  projectId: ledger.id,
  name: 'ledger-core',
  mr: { ...makeMr({ iid: 7, name: 'ledger-core' }), state: 'merged' },
});

type StateParams = {
  readonly views: ReadonlyArray<SessionMountView>;
  readonly mountRequests?: AppState['mountRequests'];
};

const stateOf = ({ views, mountRequests = {} }: StateParams) => ({
  sessionMounts: { [SESSION.id]: views },
  sessionProjectMounts: {},
  mountGithub: {},
  mountRequests,
});

describe('hasRemovedMergedMountOf', () => {
  it.each([
    { host: 'GitLab', request: GITLAB },
    { host: 'Bitbucket', request: BITBUCKET },
  ])('sees the merged $host request of a removed mount', ({ request }) => {
    const state = stateOf({
      views: [viewOf({ id: ledgerMount, isAttached: false })],
      mountRequests: { [ledgerMount]: request },
    });

    expect(hasRemovedMergedMountOf({ state, sessionId: SESSION.id })).toBe(true);
  });

  it('stays false while another branch of the session is still open', () => {
    const state = stateOf({
      views: [
        viewOf({ id: ledgerMount, isAttached: false }),
        viewOf({ id: relayMount, isAttached: true }),
      ],
      mountRequests: { [ledgerMount]: GITLAB },
    });

    expect(hasRemovedMergedMountOf({ state, sessionId: SESSION.id })).toBe(false);
  });

  it('stays false for a closed mount whose request never merged', () => {
    const state = stateOf({ views: [viewOf({ id: ledgerMount, isAttached: false })] });

    expect(hasRemovedMergedMountOf({ state, sessionId: SESSION.id })).toBe(false);
  });
});
