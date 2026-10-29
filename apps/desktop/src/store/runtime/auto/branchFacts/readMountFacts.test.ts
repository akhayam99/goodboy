// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { composeBranchFacts } from '@goodboy/core';
import {
  brandId,
  type IsoDateTime,
  type MountId,
  type PrComment,
  type ProjectId,
  type PullRequestState,
  type SessionId,
  type SessionProjectMount,
  type WorkspaceId,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';

const h = vi.hoisted(() => ({
  run: vi.fn(),
}));

vi.mock('../../../../features/integrations/github/github', () => ({
  tauriGhRunner: { run: h.run },
}));

import type { AppStore } from '../../../store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../storyHarness';
import type { MountGithubState } from '../../../types';
import { makeBranchFactsReaders } from '../makeBranchFactsReaders';
import type { ReadBranchFactsParams } from '../ports';
import { readBranchFactsOf } from './readBranchFactsOf';

let useAppStore: StoryStore;

const STAMP = brandId<IsoDateTime>({ value: '2026-10-19T09:00:00.000Z' });
const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });

type RepoFixture = Readonly<{
  repo: string;
  projectId: ProjectId;
  mountId: MountId;
  number: number;
  branch: string;
}>;

const LEDGER: RepoFixture = {
  repo: 'harborline/ledger-core',
  projectId: brandId<ProjectId>({ value: 'project-ledger-core' }),
  mountId: brandId<MountId>({ value: 'mount-ledger-core' }),
  number: 421,
  branch: 'ak/ledger-export',
};

const RELAY: RepoFixture = {
  repo: 'harborline/notify-relay',
  projectId: brandId<ProjectId>({ value: 'project-notify-relay' }),
  mountId: brandId<MountId>({ value: 'mount-notify-relay' }),
  number: 77,
  branch: 'ak/relay-retries',
};

const BARE: RepoFixture = {
  repo: 'harborline/payments-api',
  projectId: brandId<ProjectId>({ value: 'project-payments-api' }),
  mountId: brandId<MountId>({ value: 'mount-payments-api' }),
  number: 0,
  branch: 'ak/fix-credit',
};

const paramsOf = ({ fixture }: { readonly fixture: RepoFixture }): ReadBranchFactsParams => ({
  sessionId: SESSION_ID,
  mountId: fixture.mountId,
  worktreePath: `/work/${fixture.mountId}`,
  branch: fixture.branch,
});

const pullRequestOf = ({ fixture }: { readonly fixture: RepoFixture }): PullRequestState => ({
  number: fixture.number,
  title: `Change ${fixture.number}`,
  url: `https://github.com/${fixture.repo}/pull/${fixture.number}`,
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: fixture.branch,
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: STAMP,
});

const commentOf = ({ id, body }: { readonly id: string; readonly body: string }): PrComment => ({
  id,
  author: 'northwind-dev',
  authorAvatarUrl: null,
  body,
  createdAt: STAMP,
  url: `https://github.com/harborline/comment/${id}`,
  source: 'review',
  path: 'src/export.ts',
});

type GithubParams = {
  readonly fixture: RepoFixture;
  readonly comments?: ReadonlyArray<PrComment>;
  readonly patch?: Partial<MountGithubState>;
};

const githubOf = ({ fixture, comments = [], patch = {} }: GithubParams): MountGithubState => {
  const isOpen = fixture.number > 0;
  return {
    mountId: fixture.mountId,
    projectId: fixture.projectId,
    revision: 1,
    repository: fixture.repo,
    host: 'github.com',
    branch: fixture.branch,
    prs: isOpen ? [pullRequestOf({ fixture })] : [],
    links: [],
    pr: isOpen ? pullRequestOf({ fixture }) : null,
    linkedIssues: [],
    fetchedAt: STAMP,
    failedAt: null,
    loading: false,
    error: null,
    detail: isOpen
      ? {
          prNumber: fixture.number,
          comments,
          reviews: [],
          reviewRequests: [],
          checks: [],
        }
      : null,
    detailFetchedAt: STAMP,
    detailLoading: false,
    detailError: null,
    ...patch,
  };
};

const mountOf = ({ fixture }: { readonly fixture: RepoFixture }): SessionProjectMount => ({
  mountId: fixture.mountId,
  sessionId: SESSION_ID,
  projectId: fixture.projectId,
  mountName: fixture.mountId,
  worktreePath: `/work/${fixture.mountId}`,
  lastWorktreePath: `/work/${fixture.mountId}`,
  repoRoot: `/repos/${fixture.mountId}`,
  branch: fixture.branch,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const projectOf = ({ fixture }: { readonly fixture: RepoFixture }) =>
  aProject({
    id: fixture.projectId,
    workspaceId: WORKSPACE_ID,
    name: fixture.mountId,
    remoteUrl: `https://github.com/${fixture.repo}.git`,
  });

type StateParams = {
  readonly github: Readonly<Record<MountId, MountGithubState>>;
  readonly active: RepoFixture;
};

const stateOf = ({ github, active }: StateParams): AppStore =>
  Object.assign({}, useAppStore.getInitialState(), {
    sessions: [aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    projects: [LEDGER, RELAY, BARE].map((fixture) => projectOf({ fixture })),
    sessionProjectMounts: {
      [SESSION_ID]: [LEDGER, RELAY, BARE].map((fixture) => mountOf({ fixture })),
    },
    sessionActiveMount: { [SESSION_ID]: active.mountId },
    sessionActiveProject: { [SESSION_ID]: active.projectId },
    mountGithub: github,
    sessionGithub: { [SESSION_ID]: github[active.mountId] },
    refreshSessionPr: vi.fn(async () => undefined),
    refreshSessionPrDetail: vi.fn(async () => undefined),
    refreshReviewSource: vi.fn(async () => undefined),
  });

const jsonOk = (data: unknown) => ({ stdout: JSON.stringify(data), stderr: '', exitCode: 0 });

const viewOf = ({ fixture }: { readonly fixture: RepoFixture }) => ({
  number: fixture.number,
  title: `Change ${fixture.number}`,
  body: '',
  url: `https://github.com/${fixture.repo}/pull/${fixture.number}`,
  state: 'OPEN',
  isDraft: false,
  author: { login: 'northwind-dev', name: null, is_bot: false },
  baseRefName: 'main',
  headRefName: fixture.branch,
  headRefOid: 'a41c9e2b7d3',
  createdAt: STAMP,
  updatedAt: STAMP,
  mergedAt: null,
  mergeable: 'MERGEABLE',
  reviewDecision: null,
  autoMergeRequest: null,
  closingIssuesReferences: [],
  commits: [],
  files: [],
});

const answerGh = (args: ReadonlyArray<string>) => {
  const joined = args.join(' ');
  if (args[0] === 'pr' && args[1] === 'view') {
    const fixture = [LEDGER, RELAY].find((candidate) => args[2] === String(candidate.number));
    if (fixture === undefined) {
      return { stdout: '', stderr: `no pull request ${args[2]}`, exitCode: 1 };
    }
    if (joined.includes('closingIssuesReferences')) {
      return jsonOk(viewOf({ fixture }));
    }
    if (joined.endsWith('--json statusCheckRollup')) {
      return jsonOk({
        statusCheckRollup: [
          {
            name: `ci-${fixture.number}`,
            status: 'COMPLETED',
            conclusion: 'SUCCESS',
            startedAt: STAMP,
            completedAt: STAMP,
            detailsUrl: 'https://github.com/harborline/actions/runs/1',
          },
        ],
      });
    }
    if (joined.endsWith('--json reviews')) {
      return jsonOk({ reviews: [] });
    }
    if (joined.endsWith('--json reviewRequests')) {
      return jsonOk({ reviewRequests: [] });
    }
  }
  if (args[0] === 'repo' && args[1] === 'view') {
    return jsonOk({ squashMergeAllowed: true, mergeCommitAllowed: true, rebaseMergeAllowed: true });
  }
  return jsonOk([]);
};

type BriefParams = {
  readonly state: AppStore;
  readonly fixture: RepoFixture;
};

const briefOf = async ({ state, fixture }: BriefParams): Promise<string> => {
  const readers = makeBranchFactsReaders({
    getState: () => state,
    commitRange: vi.fn(async () => [{ sha: 'abc123def', subject: 'feat: export the ledger' }]),
  });
  const parts = await readBranchFactsOf({ readers, params: paramsOf({ fixture }) });
  return composeBranchFacts({ facts: [{ mountLabel: fixture.mountId, ...parts }] }) ?? '';
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  h.run.mockReset();
  h.run.mockImplementation(async (args: ReadonlyArray<string>) => answerGh(args));
});

describe('the branch facts of a session with several mounts', () => {
  let state: AppStore;

  beforeEach(() => {
    state = stateOf({
      active: LEDGER,
      github: {
        [LEDGER.mountId]: githubOf({
          fixture: LEDGER,
          comments: [
            commentOf({ id: 'a', body: 'rename it' }),
            commentOf({ id: 'b', body: 'why' }),
          ],
        }),
        [RELAY.mountId]: githubOf({
          fixture: RELAY,
          comments: [commentOf({ id: 'c', body: 'add a retry cap' })],
        }),
        [BARE.mountId]: githubOf({ fixture: BARE }),
      },
    });
  });

  it('names the own pull request, threads and checks of the active mount', async () => {
    const brief = await briefOf({ state, fixture: LEDGER });
    expect(brief).toContain('Pull request: 421');
    expect(brief).toContain('Open review threads: 2');
    expect(brief).toContain('ci-421: success');
    expect(brief).not.toContain('Pull request: 77');
  });

  it('names the own pull request, threads and checks of a mount that is not active', async () => {
    const brief = await briefOf({ state, fixture: RELAY });
    expect(brief).toContain('Pull request: 77');
    expect(brief).toContain('harborline/notify-relay/pull/77');
    expect(brief).toContain('Open review threads: 1');
    expect(brief).toContain('add a retry cap');
    expect(brief).toContain('ci-77: success');
    expect(brief).not.toContain('421');
    expect(brief).not.toContain('none is open');
  });

  it('reads the detail of the mount it is asked about, not of the active one', async () => {
    await briefOf({ state, fixture: RELAY });
    expect(state.refreshSessionPrDetail).toHaveBeenCalledWith(SESSION_ID, {
      mountId: RELAY.mountId,
      force: true,
    });
    expect(state.refreshSessionPr).toHaveBeenCalledWith(SESSION_ID, {
      mountId: RELAY.mountId,
      force: true,
    });
  });

  it('says none for a mount that has no pull request', async () => {
    const brief = await briefOf({ state, fixture: BARE });
    expect(brief).toContain('Pull request: none is open for this branch');
    expect(brief).not.toContain('Pull request: 421');
    expect(brief).not.toContain('Pull request: 77');
  });
});

describe('a mount whose pull request cannot be read', () => {
  it('says unknown when the host failed and nothing is known, never none', async () => {
    const state = stateOf({
      active: LEDGER,
      github: {
        [LEDGER.mountId]: githubOf({ fixture: LEDGER }),
        [RELAY.mountId]: githubOf({
          fixture: { ...RELAY, number: 0 },
          patch: { fetchedAt: null, failedAt: STAMP, error: 'the host answered 502' },
        }),
      },
    });
    const brief = await briefOf({ state, fixture: RELAY });
    expect(brief).toContain('Pull request: Facts not available: the host answered 502');
    expect(brief).not.toContain('none is open');
    expect(brief).not.toContain('Pull request: 421');
  });

  it('says unknown when the mount was never read', async () => {
    const state = stateOf({
      active: LEDGER,
      github: { [LEDGER.mountId]: githubOf({ fixture: LEDGER }) },
    });
    const brief = await briefOf({ state, fixture: RELAY });
    expect(brief).toContain('Pull request: Facts not available');
    expect(brief).not.toContain('none is open');
  });

  it('says unknown for the threads when the detail of that mount failed', async () => {
    const state = stateOf({
      active: LEDGER,
      github: {
        [LEDGER.mountId]: githubOf({ fixture: LEDGER }),
        [RELAY.mountId]: githubOf({
          fixture: RELAY,
          patch: { detail: null, detailError: 'rate limited' },
        }),
      },
    });
    const brief = await briefOf({ state, fixture: RELAY });
    expect(brief).toContain('Pull request: 77');
    expect(brief).toContain('Review threads: Facts not available: rate limited');
    expect(brief).not.toContain('Open review threads: 0');
  });

  it('says unknown for the threads when the detail is of another request', async () => {
    const relay = githubOf({ fixture: RELAY });
    const state = stateOf({
      active: LEDGER,
      github: {
        [LEDGER.mountId]: githubOf({ fixture: LEDGER }),
        [RELAY.mountId]: {
          ...relay,
          detail: relay.detail === null ? null : { ...relay.detail, prNumber: 421 },
        },
      },
    });
    const brief = await briefOf({ state, fixture: RELAY });
    expect(brief).toContain('Review threads: Facts not available');
    expect(brief).not.toContain('Open review threads: 0');
  });
});

describe('the host of a mount', () => {
  it('comes from the remote of that mount, not from the active one', async () => {
    const base = stateOf({
      active: LEDGER,
      github: { [LEDGER.mountId]: githubOf({ fixture: LEDGER }) },
    });
    const state = Object.assign({}, base, {
      projects: [
        projectOf({ fixture: LEDGER }),
        aProject({
          id: BARE.projectId,
          workspaceId: WORKSPACE_ID,
          name: BARE.mountId,
          remoteUrl: 'https://gitlab.com/harborline/payments-api.git',
        }),
      ],
      refreshSessionMr: vi.fn(async () => undefined),
    });
    const brief = await briefOf({ state, fixture: BARE });
    expect(state.refreshSessionMr).toHaveBeenCalledWith(SESSION_ID, {
      mountId: BARE.mountId,
      force: true,
    });
    expect(state.refreshSessionPr).not.toHaveBeenCalled();
    expect(brief).toContain('Pull request: Facts not available');
    expect(brief).not.toContain('Pull request: 421');
  });
});
