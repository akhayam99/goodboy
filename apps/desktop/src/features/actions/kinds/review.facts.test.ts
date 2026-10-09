// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, MountId, ProjectId, SessionId } from '@goodboy/types';
import { useAppStore, type AppStore } from '../../../store/store';
import type { MountGithubState } from '../../../store/types';
import { REVIEW_KIND } from './review';

const SESSION = 'session' as SessionId;
const STAMP = '2026-09-04T14:20:00.000Z' as IsoDateTime;
const LEDGER = 'ledger' as MountId;
const RELAY = 'relay' as MountId;

const mountOf = (id: string, name: string) => ({
  id: id as MountId,
  sessionId: SESSION,
  projectId: `${id}-project` as ProjectId,
  worktreePath: `/repo/${name}`,
  lastWorktreePath: null,
  branch: `hl/${name}`,
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: name,
  repoSlug: null,
  isAttached: true,
  diskState: 'present' as const,
  revision: 1,
  createdAt: STAMP,
  updatedAt: STAMP,
  repoRoot: `/repo/${name}`,
});

const githubOf = (id: string, number: number): MountGithubState => ({
  mountId: id as MountId,
  projectId: `${id}-project` as ProjectId,
  revision: 1,
  repository: null,
  host: null,
  branch: `hl/${id}`,
  prs: [],
  links: [],
  pr: {
    number,
    title: 'Guard the batch',
    url: `https://example.invalid/harborline/${id}/pull/${number}`,
    state: 'open',
    mergeable: true,
    checks: 'success',
    baseBranch: 'main',
    headBranch: `hl/${id}`,
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: STAMP,
  },
  linkedIssues: [],
  fetchedAt: null,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
});

const twoMounts = (overrides: Partial<AppStore> = {}): AppStore => ({
  ...useAppStore.getInitialState(),
  sessions: [],
  projects: [],
  sessionProjectMounts: {},
  sessionActiveProject: {},
  sessionActiveMount: { [SESSION]: LEDGER },
  sessionGithub: {},
  sessionGitlabMr: {},
  sessionBitbucketPr: {},
  mountGitlabMr: {},
  mountBitbucketPr: {},
  diffComments: {},
  reviewSourceKeys: {},
  reviewSourceThreads: {},
  sessionMounts: {
    [SESSION]: [mountOf('ledger', 'ledger-core'), mountOf('relay', 'notify-relay')],
  },
  mountGithub: { [LEDGER]: githubOf('ledger', 31), [RELAY]: githubOf('relay', 32) },
  ...overrides,
});

const targetOf = (state: AppStore) =>
  REVIEW_KIND.facts({ state, target: { kind: 'review', sessionId: SESSION } })?.reviewTarget ??
  null;

describe('the pull request that notes move to', () => {
  it('is the one of the mount the diff shows, not the one of the active mount', () => {
    const state = twoMounts({ diffMountPath: { [SESSION]: '/repo/notify-relay' } });

    expect(targetOf(state)).toEqual({
      provider: 'github',
      repo: 'harborline/relay',
      prNumber: 32,
    });
  });

  it('is the active mount pull request when the diff shows that mount', () => {
    expect(targetOf(twoMounts())).toEqual({
      provider: 'github',
      repo: 'harborline/ledger',
      prNumber: 31,
    });
  });

  it('is missing when the mount the diff shows has no pull request of its own', () => {
    const state = twoMounts({
      diffMountPath: { [SESSION]: '/repo/notify-relay' },
      mountGithub: { [LEDGER]: githubOf('ledger', 31) },
    });

    expect(targetOf(state)).toBeNull();
  });
});
