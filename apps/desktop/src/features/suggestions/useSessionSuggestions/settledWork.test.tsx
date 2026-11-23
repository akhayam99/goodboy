// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../store/storyHarness')).dbModuleMock({
    listNudgeEvents: async () => [],
  }),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { anAgent } from '@goodboy/types/testing';
import type { MountId } from '@goodboy/types';
import type { GitlabMergeRequest } from '../../integrations/gitlab/client';
import type { BitbucketPullRequest } from '../../integrations/bitbucket/client';
import type { MountGithubState } from '../../../store/types';
import type { MountRequestState } from '../../../store/slices/mount-request/state';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import {
  harborline,
  mergedGithub,
  mountOf,
  paymentsApi,
  sessionOf,
} from '../../workspace/testing/sessionColumn';
import { useSessionSuggestions } from '.';

let useAppStore: StoryStore;

const session = sessionOf({ goal: 'Fix the payout redirect in payments-api' });
const mount = { ...mountOf({ session, project: paymentsApi }), branch: 'ak/fix-redirect' };
const mountId: MountId = mount.mountId;

const implementer = anAgent({
  sessionId: session.id,
  name: 'Implementer',
  kind: 'implementer',
  status: 'completed',
  ordinal: 3,
  mountId,
});

type Settled = 'open' | 'merged' | 'closed';

type StateParams = {
  readonly state: Settled;
};

const githubOf = ({ state }: StateParams): MountGithubState => {
  const github = mergedGithub();
  const pr = github.pr === null ? null : { ...github.pr, state, headBranch: mount.branch };
  return {
    ...github,
    pr,
    mountId,
    projectId: paymentsApi.id,
    revision: 1,
    repository: 'harborline/payments-api',
    host: 'github.com',
    branch: mount.branch,
    prs: pr === null ? [] : [pr],
    links: [],
  };
};

const GITLAB_STATE: Readonly<Record<Settled, GitlabMergeRequest['state']>> = {
  open: 'opened',
  merged: 'merged',
  closed: 'closed',
};

const gitlabOf = ({ state }: StateParams): MountRequestState => {
  const mr: GitlabMergeRequest = {
    id: 4100,
    iid: 41,
    projectId: 1,
    title: 'Fix the payout redirect',
    description: null,
    state: GITLAB_STATE[state],
    webUrl: 'https://gitlab.com/harborline/payments-api/-/merge_requests/41',
    sourceBranch: mount.branch,
    targetBranch: 'main',
    draft: false,
    hasConflicts: false,
    mergeStatus: 'can_be_merged',
    updatedAt: '2026-10-04T09:00:00.000Z',
    sha: 'a41c9e2b7d3f',
  };
  return {
    kind: 'gitlab',
    mountId,
    projectId: paymentsApi.id,
    revision: 1,
    host: 'gitlab.com',
    projectPath: 'harborline/payments-api',
    branch: mount.branch,
    mr,
    mrs: [mr],
    links: [],
    approvals: null,
    fetchedAt: '2026-10-04T09:00:00.000Z',
    loading: false,
    error: null,
  };
};

const BITBUCKET_STATE: Readonly<Record<Settled, BitbucketPullRequest['state']>> = {
  open: 'OPEN',
  merged: 'MERGED',
  closed: 'DECLINED',
};

const bitbucketOf = ({ state }: StateParams): MountRequestState => {
  const pr: BitbucketPullRequest = {
    id: 52,
    title: 'Fix the payout redirect',
    description: '',
    state: BITBUCKET_STATE[state],
    createdOn: '2026-10-01T09:00:00.000Z',
    updatedOn: '2026-10-04T09:00:00.000Z',
    sourceBranch: mount.branch,
    sourceCommit: 'a41c9e2b7d3f',
    destinationBranch: 'main',
    destinationCommit: null,
    author: null,
    reviewers: [],
    participants: [],
    closeSourceBranch: false,
    mergeCommit: null,
    commentCount: 0,
    taskCount: 0,
    webUrl: 'https://bitbucket.org/harborline/payments-api/pull-requests/52',
  };
  return {
    kind: 'bitbucket',
    mountId,
    projectId: paymentsApi.id,
    revision: 1,
    host: 'bitbucket.org',
    repo: null,
    repository: 'harborline/payments-api',
    branch: mount.branch,
    pr,
    prs: [pr],
    links: [],
    checks: null,
    reviewDecision: null,
    selected: null,
    fetchedAt: '2026-10-04T09:00:00.000Z',
    loading: false,
    error: null,
  };
};

type Host = 'github' | 'gitlab' | 'bitbucket';

type SeedParams = StateParams & {
  readonly host: Host;
};

const seed = ({ host, state }: SeedParams) => {
  useAppStore.setState({
    workspaces: [harborline],
    currentWorkspaceId: harborline.id,
    projects: [paymentsApi],
    sessions: [session],
    sessionPhaseRuns: { [session.id]: [implementer] },
    sessionProjectMounts: { [session.id]: [mount] },
    mountGithub: host === 'github' ? { [mountId]: githubOf({ state }) } : {},
    mountRequests:
      host === 'gitlab'
        ? { [mountId]: gitlabOf({ state }) }
        : host === 'bitbucket'
          ? { [mountId]: bitbucketOf({ state }) }
          : {},
  });
};

const kindsOf = () => {
  const { result } = renderHook(() =>
    useSessionSuggestions({ session, agents: [implementer], withRebase: true }),
  );
  return () => result.current.map((move) => move.kind);
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ worktree_status: null });
});

afterEach(() => {
  cleanup();
});

const HOSTS: ReadonlyArray<Host> = ['github', 'gitlab', 'bitbucket'];

describe('Next for work whose pull request settled', () => {
  it.each(HOSTS)('offers Review the changes while the %s request is open', async (host) => {
    seed({ host, state: 'open' });
    const kinds = kindsOf();

    await waitFor(() => expect(kinds()).toContain('check-changes'));
  });

  it.each(HOSTS)('offers no review once the %s request is merged', async (host) => {
    seed({ host, state: 'merged' });
    const kinds = kindsOf();

    await waitFor(() => expect(kinds()).toContain('close-worktree'));
    expect(kinds()).not.toContain('check-changes');
  });

  it.each(HOSTS)('offers no review once the %s request is closed', async (host) => {
    seed({ host, state: 'closed' });
    const kinds = kindsOf();

    await waitFor(() => expect(kinds()).not.toContain('check-changes'));
    expect(kinds()).not.toContain('retry-agent');
  });
});
