import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type BitbucketIntegrationBinding,
  type GitlabIntegrationBinding,
  type IntegrationBindingId,
  type IsoDateTime,
  type IntegrationCredentialId,
  type MountId,
  type ProjectId,
  type Project,
  type PullRequestState,
  type SessionId,
  type SessionMountView,
  type WorkspaceId,
} from '@goodboy/types';
import { isoNow } from '@goodboy/types/helpers';
import { aProject, aSession, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import type { BitbucketPullRequest } from '../../../features/integrations/bitbucket/client';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storyResolveQueries,
  storySpies,
  type StoryStore,
} from '../../storyHarness';
import { aMountGithub } from '../github/testing/aMountGithub';
import type { MountBitbucketPrState } from '../bitbucket-pr/state';
import type { MountGitlabMrState } from '../gitlab-mr/state';
import { refreshSessionPrDetail } from '../github/refreshSessionPrDetail';
import { createResolveThread } from '../resolve/createResolveThread';
import { REVIEW_REFRESH_CONCURRENCY } from './requestRefreshConcurrency';
import { bitbucketThreadsKey } from './reviewSourceEntries';

const h = {
  listDiscussions: storySpies.gitlabListMrDiscussions,
  listComments: storySpies.bitbucketListPullRequestComments,
};

vi.mock('../../../features/integrations/gitlab/client', async (importOriginal) =>
  (await import('../../storyHarness')).gitlabThreadsClientModuleMock({ importOriginal }),
);

vi.mock('../../../features/integrations/bitbucket/client', async (importOriginal) =>
  (await import('../../storyHarness')).bitbucketThreadsClientModuleMock({ importOriginal }),
);

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    setResolveThreadSourceSnapshot: vi.fn(async () => true),
  }),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../features/onboarding/onboardingSettings', async () =>
  (await import('../../storyHarness')).onboardingStoreModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/skills/skills', async () =>
  (await import('../../storyHarness')).skillsModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../storyHarness')).repoModuleMock(),
);
vi.mock('../../../shared/lib/editor', async () =>
  (await import('../../storyHarness')).editorModuleMock(),
);
vi.mock('../../../features/plans/plans', async () =>
  (await import('../../storyHarness')).plansModuleMock(),
);
vi.mock('../../../features/integrations/linear/client', async () =>
  (await import('../../storyHarness')).linearClientModuleMock(),
);
vi.mock('../../../features/integrations/github/github', async () =>
  (await import('../../storyHarness')).githubModuleMock(),
);
vi.mock('@goodboy/core', async (importOriginal) =>
  (await import('../../storyHarness')).coreModuleMock(importOriginal),
);
vi.mock('../../../features/scripts/scripts', async () =>
  (await import('../../storyHarness')).scriptsModuleMock(),
);
vi.mock('../../../features/terminal/terminal', async () =>
  (await import('../../storyHarness')).terminalModuleMock(),
);
vi.mock('../../../features/settings/config-export', async () =>
  (await import('../../storyHarness')).configExportModuleMock(),
);

const WORKSPACE = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const OTHER_WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-northwind' });
const LEDGER = aProject({
  workspaceId: WORKSPACE.id,
  name: 'ledger-core',
  remoteUrl: 'git@github.com:harborline/ledger-core.git',
});
const RELAY = aProject({
  workspaceId: WORKSPACE.id,
  name: 'notify-relay',
  remoteUrl: 'https://gitlab.com/harborline/notify-relay.git',
});
const PAYMENTS = aProject({
  workspaceId: WORKSPACE.id,
  name: 'payments-api',
  remoteUrl: 'git@bitbucket.org:harborline/payments-api.git',
});
const SESSION = aSession({ workspaceId: WORKSPACE.id });

const LEDGER_MOUNT = brandId<MountId>({ value: 'mount-ledger' });
const RELAY_MOUNT = brandId<MountId>({ value: 'mount-relay' });
const PAYMENTS_MOUNT = brandId<MountId>({ value: 'mount-payments' });

const GITLAB: GitlabIntegrationBinding = {
  id: brandId<IntegrationBindingId>({ value: 'binding-gitlab' }),
  workspaceId: WORKSPACE.id,
  projectId: null,
  credentialId: brandId<IntegrationCredentialId>({ value: 'credential-gitlab' }),
  provider: 'gitlab',
  config: { host: 'gitlab.com', userName: 'kenji-w', userId: '7' },
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
};

const BITBUCKET: BitbucketIntegrationBinding = {
  id: brandId<IntegrationBindingId>({ value: 'binding-bitbucket' }),
  workspaceId: WORKSPACE.id,
  projectId: null,
  credentialId: brandId<IntegrationCredentialId>({ value: 'credential-bitbucket' }),
  provider: 'bitbucket',
  config: { workspaceSlug: 'harborline', email: 'nadia@harborline.test' },
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
};

type MountParams = {
  readonly id: MountId;
  readonly project: Project;
};

const mountView = ({ id, project }: MountParams): SessionMountView => ({
  id,
  sessionId: SESSION.id,
  projectId: project.id,
  mountName: project.name,
  worktreePath: `/worktrees/${project.name}`,
  lastWorktreePath: null,
  repoRoot: `/repos/${project.name}`,
  branch: `ak/${project.name}`,
  baseBranch: 'main',
  parallelIndex: 0,
  repoSlug: null,
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
});

type EndedParams = {
  readonly projectId: ProjectId;
};

const mergedPr: PullRequestState = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://github.com/harborline/ledger-core/pull/318',
  state: 'merged',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'ak/ledger-core',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: TEST_NOW,
};

const mergedMr: GitlabMergeRequest = {
  id: 700,
  iid: 7,
  projectId: 1,
  title: 'Retry notify-relay deliveries',
  description: null,
  state: 'merged',
  webUrl: 'https://gitlab.com/harborline/notify-relay/-/merge_requests/7',
  sourceBranch: 'ak/notify-relay',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: TEST_NOW,
  sha: 'a41c9e2b7d3f',
};

const declinedPr: BitbucketPullRequest = {
  id: 42,
  title: 'Stop retried webhooks posting a second credit',
  description: '',
  state: 'MERGED',
  createdOn: TEST_NOW,
  updatedOn: TEST_NOW,
  sourceBranch: 'ak/payments-api',
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
  webUrl: 'https://bitbucket.org/harborline/payments-api/pull-requests/42',
};

const gitlabEntry = ({
  mr,
  fetchedAt,
}: {
  readonly mr: GitlabMergeRequest | null;
  readonly fetchedAt: MountGitlabMrState['fetchedAt'];
}): MountGitlabMrState => ({
  mountId: RELAY_MOUNT,
  projectId: RELAY.id,
  revision: 1,
  host: 'gitlab.com',
  projectPath: 'harborline/notify-relay',
  branch: 'ak/notify-relay',
  mr,
  mrs: mr === null ? [] : [mr],
  links: [],
  approvals: null,
  fetchedAt,
  loading: false,
  error: null,
});

const bitbucketEntry = ({
  pr,
  fetchedAt,
}: {
  readonly pr: BitbucketPullRequest | null;
  readonly fetchedAt: MountBitbucketPrState['fetchedAt'];
}): MountBitbucketPrState => ({
  mountId: PAYMENTS_MOUNT,
  projectId: PAYMENTS.id,
  revision: 1,
  host: 'bitbucket.org',
  repo: {
    workspaceId: WORKSPACE.id,
    workspaceSlug: 'harborline',
    repoSlug: 'payments-api',
    email: 'nadia@harborline.test',
  },
  repository: 'harborline/payments-api',
  branch: 'ak/payments-api',
  prs: pr === null ? [] : [pr],
  links: [],
  checks: null,
  reviewDecision: null,
  pr,
  fetchedAt,
  loading: false,
  error: null,
});

const githubEntry = ({ pr }: { readonly pr: PullRequestState | null }) => ({
  ...aMountGithub({ mountId: LEDGER_MOUNT, projectId: LEDGER.id }),
  pr,
});

let store: StoryStore;

const refreshGithub = vi.fn(async (_sessionId: SessionId, _options?: unknown) => undefined);
const refreshGitlab = vi.fn(async (_sessionId: SessionId, _options?: unknown) => undefined);
const refreshBitbucket = vi.fn(async (_sessionId: SessionId, _options?: unknown) => undefined);
const refreshDetail = vi.fn(async (_sessionId: SessionId, _options?: unknown) => undefined);

const flush = async (): Promise<void> => {
  for (let tick = 0; tick < 400; tick += 1) {
    await Promise.resolve();
  }
};

const mountsOf = (...ids: ReadonlyArray<MountId>) => {
  const all: Readonly<Record<string, SessionMountView>> = {
    [LEDGER_MOUNT]: mountView({ id: LEDGER_MOUNT, project: LEDGER }),
    [RELAY_MOUNT]: mountView({ id: RELAY_MOUNT, project: RELAY }),
    [PAYMENTS_MOUNT]: mountView({ id: PAYMENTS_MOUNT, project: PAYMENTS }),
  };
  return { [SESSION.id]: ids.flatMap((id) => (all[id] === undefined ? [] : [all[id]])) };
};

const calledWithMount = ({
  spy,
  mountId,
}: {
  readonly spy: typeof refreshGithub;
  readonly mountId: MountId;
}): boolean =>
  spy.mock.calls.some(([, options]) => {
    const mount =
      typeof options === 'object' && options !== null && 'mountId' in options
        ? options.mountId
        : undefined;
    return mount === mountId;
  });

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  for (const spy of [refreshGithub, refreshGitlab, refreshBitbucket, refreshDetail]) {
    spy.mockReset();
    spy.mockResolvedValue(undefined);
  }
  store.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    projects: [LEDGER, RELAY, PAYMENTS],
    sessions: [SESSION],
    sessionMounts: mountsOf(LEDGER_MOUNT, RELAY_MOUNT, PAYMENTS_MOUNT),
    sessionActiveMount: { [SESSION.id]: LEDGER_MOUNT },
    sessionActiveProject: { [SESSION.id]: LEDGER.id },
    githubStatus: { mode: 'gh-cli', available: true },
    workspaceIntegrations: { [WORKSPACE.id]: [GITLAB, BITBUCKET] },
    mountGithub: {},
    mountGitlabMr: {},
    mountBitbucketPr: {},
    currentSessionId: null,
    boardReady: false,
    refreshSessionPr: refreshGithub,
    refreshSessionMr: refreshGitlab,
    refreshSessionBitbucketPr: refreshBitbucket,
    refreshSessionPrDetail: refreshDetail,
  });
});

describe('sweepRequests', () => {
  describe('one sweep for three hosts', () => {
    it('sends each mount to the request port of the host its remote names', () => {
      void store.getState().sweepRequests();

      expect(refreshGithub).toHaveBeenCalledTimes(1);
      expect(calledWithMount({ spy: refreshGithub, mountId: LEDGER_MOUNT })).toBe(true);
      expect(refreshGitlab).toHaveBeenCalledTimes(1);
      expect(calledWithMount({ spy: refreshGitlab, mountId: RELAY_MOUNT })).toBe(true);
      expect(refreshBitbucket).toHaveBeenCalledTimes(1);
      expect(calledWithMount({ spy: refreshBitbucket, mountId: PAYMENTS_MOUNT })).toBe(true);
    });

    it('names the session and asks quietly with one retry on every host', () => {
      void store.getState().sweepRequests();

      for (const spy of [refreshGithub, refreshGitlab, refreshBitbucket]) {
        expect(spy).toHaveBeenCalledWith(
          SESSION.id,
          expect.objectContaining({ silent: true, retries: 1 }),
        );
      }
    });

    it('leaves a GitLab mount alone while GitLab is not connected', () => {
      store.setState({ workspaceIntegrations: { [WORKSPACE.id]: [BITBUCKET] } });

      void store.getState().sweepRequests();

      expect(refreshGitlab).not.toHaveBeenCalled();
      expect(refreshGithub).toHaveBeenCalledTimes(1);
      expect(refreshBitbucket).toHaveBeenCalledTimes(1);
    });

    it('still sweeps GitLab and Bitbucket when gh is unavailable, and never calls gh', async () => {
      store.setState({ githubStatus: { mode: 'absent', available: false } });

      void store.getState().sweepRequests();
      await flush();

      expect(refreshGithub).not.toHaveBeenCalled();
      expect(refreshGitlab).toHaveBeenCalledTimes(1);
      expect(refreshBitbucket).toHaveBeenCalledTimes(1);
      expect(store.getState().boardReady).toBe(true);
    });

    it('does not send a GitLab remote to gh when the project has no remote yet', () => {
      store.setState({
        projects: [LEDGER, { ...RELAY, remoteUrl: undefined }, PAYMENTS],
        mountGitlabMr: { [RELAY_MOUNT]: gitlabEntry({ mr: null, fetchedAt: TEST_NOW }) },
      });

      void store.getState().sweepRequests();

      expect(refreshGitlab).toHaveBeenCalledTimes(1);
      expect(refreshGithub).toHaveBeenCalledTimes(1);
      expect(calledWithMount({ spy: refreshGithub, mountId: RELAY_MOUNT })).toBe(false);
    });
  });

  describe('boardReady', () => {
    it('releases at once when no host can be asked', () => {
      store.setState({
        githubStatus: { mode: 'absent', available: false },
        workspaceIntegrations: {},
      });

      void store.getState().sweepRequests();

      expect(store.getState().boardReady).toBe(true);
      expect(refreshGithub).not.toHaveBeenCalled();
    });

    it('releases when gh answers and no mount has a branch to ask about', () => {
      store.setState({
        sessionMounts: {
          [SESSION.id]: [{ ...mountView({ id: LEDGER_MOUNT, project: LEDGER }), branch: '' }],
        },
      });

      void store.getState().sweepRequests();

      expect(store.getState().boardReady).toBe(true);
      expect(refreshGithub).not.toHaveBeenCalled();
    });

    it('releases after every host settled and not before', async () => {
      const gates: Array<() => void> = [];
      for (const spy of [refreshGithub, refreshGitlab, refreshBitbucket]) {
        spy.mockImplementation(
          () =>
            new Promise<undefined>((resolve) => {
              gates.push(() => resolve(undefined));
            }),
        );
      }

      void store.getState().sweepRequests();
      expect(gates).toHaveLength(3);

      gates[0]?.();
      gates[1]?.();
      await flush();
      expect(store.getState().boardReady).toBe(false);

      gates[2]?.();
      await flush();
      expect(store.getState().boardReady).toBe(true);
    });

    it('drops the release when the workspace changed while it waited', async () => {
      let release: () => void = () => undefined;
      refreshGithub.mockImplementation(
        () =>
          new Promise<undefined>((resolve) => {
            release = () => resolve(undefined);
          }),
      );
      store.setState({ sessionMounts: mountsOf(LEDGER_MOUNT) });

      void store.getState().sweepRequests();
      store.setState({ currentWorkspaceId: OTHER_WORKSPACE });
      release();
      await flush();

      expect(store.getState().boardReady).toBe(false);
    });
  });

  describe('skip rules on every host', () => {
    it('skips a request that ended, on GitHub, GitLab and Bitbucket alike', () => {
      store.setState({
        mountGithub: { [LEDGER_MOUNT]: githubEntry({ pr: mergedPr }) },
        mountGitlabMr: { [RELAY_MOUNT]: gitlabEntry({ mr: mergedMr, fetchedAt: TEST_NOW }) },
        mountBitbucketPr: {
          [PAYMENTS_MOUNT]: bitbucketEntry({ pr: declinedPr, fetchedAt: TEST_NOW }),
        },
      });

      void store.getState().sweepRequests();

      expect(refreshGithub).not.toHaveBeenCalled();
      expect(refreshGitlab).not.toHaveBeenCalled();
      expect(refreshBitbucket).not.toHaveBeenCalled();
    });

    it('keeps polling a sibling mount after one of them merged', () => {
      store.setState({
        mountGithub: { [LEDGER_MOUNT]: githubEntry({ pr: mergedPr }) },
      });

      void store.getState().sweepRequests();

      expect(refreshGithub).not.toHaveBeenCalled();
      expect(refreshGitlab).toHaveBeenCalledTimes(1);
      expect(refreshBitbucket).toHaveBeenCalledTimes(1);
    });

    it('skips a mount already read with no request when only the focus sweep runs', () => {
      store.setState({
        mountGithub: { [LEDGER_MOUNT]: githubEntry({ pr: null }) },
        mountGitlabMr: { [RELAY_MOUNT]: gitlabEntry({ mr: null, fetchedAt: TEST_NOW }) },
        mountBitbucketPr: {
          [PAYMENTS_MOUNT]: bitbucketEntry({ pr: null, fetchedAt: TEST_NOW }),
        },
      });

      void store.getState().sweepRequests({ shouldSkipUnknownRequest: true });

      expect(refreshGithub).not.toHaveBeenCalled();
      expect(refreshGitlab).not.toHaveBeenCalled();
      expect(refreshBitbucket).not.toHaveBeenCalled();
    });

    it('asks again about a mount with no request when the focus sweep is off', () => {
      store.setState({
        mountGitlabMr: { [RELAY_MOUNT]: gitlabEntry({ mr: null, fetchedAt: TEST_NOW }) },
      });

      void store.getState().sweepRequests({ shouldSkipUnknownRequest: false });

      expect(refreshGitlab).toHaveBeenCalledTimes(1);
    });

    it('asks about a mount that was never read even in the focus sweep', () => {
      void store.getState().sweepRequests({ shouldSkipUnknownRequest: true });

      expect(refreshGithub).toHaveBeenCalledTimes(1);
      expect(refreshGitlab).toHaveBeenCalledTimes(1);
      expect(refreshBitbucket).toHaveBeenCalledTimes(1);
    });
  });

  describe('detail of the current session', () => {
    it('reads the GitHub detail after the request settles, and only for GitHub', async () => {
      store.setState({ currentSessionId: SESSION.id });

      void store.getState().sweepRequests();
      await flush();

      expect(refreshDetail).toHaveBeenCalledTimes(1);
      expect(calledWithMount({ spy: refreshDetail, mountId: LEDGER_MOUNT })).toBe(true);
    });

    it('reads no detail for a session that is not open', async () => {
      void store.getState().sweepRequests();
      await flush();

      expect(refreshDetail).not.toHaveBeenCalled();
    });
  });

  describe('review threads of the current session', () => {
    const openMr: GitlabMergeRequest = { ...mergedMr, state: 'opened' };
    const openPr: BitbucketPullRequest = { ...declinedPr, state: 'OPEN' };
    const openGithubPr: PullRequestState = { ...mergedPr, state: 'open' };
    const resolveRows = storyResolveQueries.listResolveThreads;
    const gitlabKey = openMr.webUrl;
    const bitbucketKey = bitbucketThreadsKey({ mountId: PAYMENTS_MOUNT, pr: openPr });
    const staleAt = brandId<IsoDateTime>({ value: new Date(Date.now() - 600_000).toISOString() });

    type KeptCommentParams = { readonly id: string; readonly threadId: string };
    type DiscussionParams = {
      readonly id: string;
      readonly body: string;
      readonly isResolved?: boolean;
    };
    type BitbucketCommentParams = { readonly body: string };
    type ThreadsOfParams = { readonly key: string };

    const keptComment = ({ id, threadId }: KeptCommentParams) => ({
      id,
      author: 'kenji-w',
      authorAvatarUrl: null,
      body: 'Kept',
      createdAt: TEST_NOW,
      url: '',
      source: 'review' as const,
      threadId,
    });

    const discussion = ({ id, body, isResolved = false }: DiscussionParams) => ({
      id,
      individualNote: false,
      notes: [
        {
          id: 1,
          body,
          system: false,
          author: { username: 'kenji-w', name: 'Kenji W', avatarUrl: null },
          createdAt: TEST_NOW,
          resolvable: true,
          resolved: isResolved,
          position: { newPath: 'src/relay.ts', oldPath: null, newLine: 4, oldLine: null },
        },
      ],
    });

    const bitbucketComment = ({ body }: BitbucketCommentParams) => ({
      id: 9,
      body,
      user: { nickname: 'nadia', displayName: 'Nadia', avatarUrl: null },
      createdOn: TEST_NOW,
      deleted: false,
      parentId: null,
      inline: { path: 'src/payments.ts', from: null, to: 12 },
      webUrl: null,
    });

    const threadsOf = ({ key }: ThreadsOfParams) =>
      store.getState().reviewSourceThreads[SESSION.id]?.[key];

    beforeEach(() => {
      h.listDiscussions.mockReset();
      h.listComments.mockReset();
      resolveRows.mockClear();
      resolveRows.mockImplementation(async () => []);
      store.setState({
        currentSessionId: SESSION.id,
        reviewSourceThreads: {},
        mountGitlabMr: { [RELAY_MOUNT]: gitlabEntry({ mr: openMr, fetchedAt: TEST_NOW }) },
        mountBitbucketPr: {
          [PAYMENTS_MOUNT]: bitbucketEntry({ pr: openPr, fetchedAt: TEST_NOW }),
        },
      });
    });

    it('brings GitLab threads in with the sweep, for the mount that has the request', async () => {
      h.listDiscussions.mockResolvedValue([
        discussion({ id: 'd1', body: 'Keep the retry count here' }),
      ]);

      await store.getState().sweepRequests();

      expect(h.listDiscussions).toHaveBeenCalledTimes(1);
      expect(threadsOf({ key: gitlabKey })?.comments.map((comment) => comment.body)).toEqual([
        'Keep the retry count here',
      ]);
      expect(threadsOf({ key: gitlabKey })?.loading).toBe(false);
      expect(resolveRows).toHaveBeenCalledWith(expect.objectContaining({ sessionId: SESSION.id }));
    });

    it('brings Bitbucket threads in with the sweep, keyed by mount and request', async () => {
      h.listComments.mockResolvedValue([
        bitbucketComment({ body: 'Name this payments-api guard' }),
      ]);

      await store.getState().sweepRequests();

      expect(h.listComments).toHaveBeenCalledTimes(1);
      expect(threadsOf({ key: bitbucketKey })?.comments.map((comment) => comment.body)).toEqual([
        'Name this payments-api guard',
      ]);
      expect(threadsOf({ key: bitbucketKey })?.fetchedAt).not.toBeNull();
    });

    it('reads no GitLab or Bitbucket threads for a session that is not open', async () => {
      store.setState({ currentSessionId: null });

      void store.getState().sweepRequests();
      await flush();

      expect(h.listDiscussions).not.toHaveBeenCalled();
      expect(h.listComments).not.toHaveBeenCalled();
    });

    it('leaves threads that are still fresh alone on a quiet sweep', async () => {
      store.setState({
        reviewSourceThreads: {
          [SESSION.id]: {
            [gitlabKey]: {
              comments: [],
              fetchedAt: isoNow(),
              loading: false,
              error: null,
            },
          },
        },
      });
      h.listComments.mockResolvedValue([]);

      void store.getState().sweepRequests();
      await flush();

      expect(h.listDiscussions).not.toHaveBeenCalled();
      expect(h.listComments).toHaveBeenCalledTimes(1);
    });

    it('drops a late GitLab answer when the mount moved on while it was in flight', async () => {
      let answer: (value: ReadonlyArray<unknown>) => void = () => undefined;
      h.listDiscussions.mockImplementation(
        () =>
          new Promise((resolve) => {
            answer = resolve;
          }),
      );

      void store.getState().sweepRequests();
      await flush();
      store.setState({
        sessionMounts: {
          [SESSION.id]: (store.getState().sessionMounts[SESSION.id] ?? []).map((mount) =>
            mount.id === RELAY_MOUNT ? { ...mount, revision: 2 } : mount,
          ),
        },
      });
      answer([discussion({ id: 'd1', body: 'Answer for the old branch' })]);
      await flush();

      expect(threadsOf({ key: gitlabKey })?.comments).toEqual([]);
      expect(threadsOf({ key: gitlabKey })?.loading).toBe(false);
      expect(resolveRows).not.toHaveBeenCalled();
    });

    it('drops a late Bitbucket answer when the mount moved on while it was in flight', async () => {
      let answer: (value: ReadonlyArray<unknown>) => void = () => undefined;
      h.listComments.mockImplementation(
        () =>
          new Promise((resolve) => {
            answer = resolve;
          }),
      );

      void store.getState().sweepRequests();
      await flush();
      store.setState({
        sessionMounts: {
          [SESSION.id]: (store.getState().sessionMounts[SESSION.id] ?? []).map((mount) =>
            mount.id === PAYMENTS_MOUNT ? { ...mount, revision: 2 } : mount,
          ),
        },
      });
      answer([bitbucketComment({ body: 'Answer for the old branch' })]);
      await flush();

      expect(threadsOf({ key: bitbucketKey })?.comments).toEqual([]);
      expect(threadsOf({ key: bitbucketKey })?.loading).toBe(false);
      expect(resolveRows).not.toHaveBeenCalled();
    });

    it('keeps the last GitLab threads when the host fails and does not raise the error', async () => {
      const kept = [keptComment({ id: '1', threadId: 'gitlab:d1' })];
      store.setState({
        reviewSourceThreads: {
          [SESSION.id]: {
            [gitlabKey]: { comments: kept, fetchedAt: staleAt, loading: false, error: null },
          },
        },
      });
      h.listDiscussions.mockRejectedValue(new Error('gitlab unreachable'));

      void store.getState().sweepRequests();
      await flush();

      expect(threadsOf({ key: gitlabKey })).toEqual({
        comments: kept,
        fetchedAt: staleAt,
        loading: false,
        error: null,
      });
    });

    it('keeps the last Bitbucket threads when the host fails and does not raise the error', async () => {
      const kept = [keptComment({ id: '9', threadId: 'bitbucket:9' })];
      store.setState({
        reviewSourceThreads: {
          [SESSION.id]: {
            [bitbucketKey]: { comments: kept, fetchedAt: staleAt, loading: false, error: null },
          },
        },
      });
      h.listComments.mockRejectedValue(new Error('bitbucket unreachable'));

      void store.getState().sweepRequests();
      await flush();

      expect(threadsOf({ key: bitbucketKey })).toEqual({
        comments: kept,
        fetchedAt: staleAt,
        loading: false,
        error: null,
      });
    });

    it('lets the newest request win when a slow tick answers after a forced one', async () => {
      const answers: Array<(value: ReadonlyArray<unknown>) => void> = [];
      h.listDiscussions.mockImplementation(
        () =>
          new Promise((resolve) => {
            answers.push(resolve);
          }),
      );

      void store.getState().sweepRequests();
      await flush();
      const forced = store.getState().sweepRequests({ sessionId: SESSION.id, isForced: true });
      await flush();
      expect(answers).toHaveLength(2);

      answers[1]?.([discussion({ id: 'd2', body: 'Newest answer' })]);
      await forced;
      answers[0]?.([discussion({ id: 'd1', body: 'Older answer' })]);
      await flush();

      expect(threadsOf({ key: gitlabKey })?.comments.map((comment) => comment.body)).toEqual([
        'Newest answer',
      ]);
      expect(threadsOf({ key: gitlabKey })?.loading).toBe(false);
    });

    it('keeps the thread reads of a quiet sweep inside the concurrency cap', async () => {
      const extra = Array.from({ length: REVIEW_REFRESH_CONCURRENCY + 2 }, (_, index) =>
        mountView({
          id: brandId<MountId>({ value: `mount-threads-${index}` }),
          project: RELAY,
        }),
      );
      store.setState({
        sessionMounts: { [SESSION.id]: extra },
        mountGitlabMr: Object.fromEntries(
          extra.map((mount, index) => [
            mount.id,
            gitlabEntry({
              mr: { ...openMr, iid: index + 1, webUrl: `${openMr.webUrl}/${index}` },
              fetchedAt: TEST_NOW,
            }),
          ]),
        ),
      });
      let open = 0;
      let peak = 0;
      h.listDiscussions.mockImplementation(async () => {
        open += 1;
        peak = Math.max(peak, open);
        await flush();
        open -= 1;
        return [];
      });

      await store.getState().sweepRequests();

      expect(h.listDiscussions).toHaveBeenCalledTimes(extra.length);
      expect(peak).toBeLessThanOrEqual(REVIEW_REFRESH_CONCURRENCY);
    });

    it('stops an older request from writing resolve state once a newer one began', async () => {
      const answers: Array<(value: ReadonlyArray<unknown>) => void> = [];
      h.listDiscussions.mockImplementation(
        () =>
          new Promise((resolve) => {
            answers.push(resolve);
          }),
      );
      let releaseOlder: () => void = () => undefined;
      resolveRows.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseOlder = () => resolve([]);
          }),
      );

      void store.getState().sweepRequests();
      await flush();
      answers[0]?.([discussion({ id: 'd1', body: 'Older answer' })]);
      await flush();
      const forced = store.getState().sweepRequests({ sessionId: SESSION.id, isForced: true });
      await flush();
      answers[1]?.([discussion({ id: 'd2', body: 'Newest answer' })]);
      releaseOlder();
      await forced;
      await flush();

      const savedThreadIds = storyResolveQueries.upsertResolveThread.mock.calls.map(
        ([params]) => params.row.threadId,
      );
      expect(savedThreadIds).toContain('gitlab:d2');
      expect(savedThreadIds).not.toContain('gitlab:d1');
      expect(threadsOf({ key: gitlabKey })?.comments.map((comment) => comment.body)).toEqual([
        'Newest answer',
      ]);
    });

    it('keeps a thread unresolved when an older request resumes inside the resolve read', async () => {
      const row = createResolveThread({
        sessionId: SESSION.id,
        threadId: 'gitlab:d1',
        prNumber: openMr.iid,
        sourceKind: 'gitlab',
      });
      let releaseOlder: () => void = () => undefined;
      resolveRows.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseOlder = () => resolve([row]);
          }),
      );
      resolveRows.mockImplementation(async () => [row]);
      storyResolveQueries.upsertResolveThread.mockClear();
      h.listDiscussions
        .mockResolvedValueOnce([discussion({ id: 'd1', body: 'Older', isResolved: true })])
        .mockResolvedValueOnce([discussion({ id: 'd1', body: 'Newer', isResolved: false })]);

      void store.getState().sweepRequests();
      await flush();
      const forced = store.getState().sweepRequests({ sessionId: SESSION.id, isForced: true });
      await flush();
      releaseOlder();
      await forced;
      await flush();

      const closedWrites = storyResolveQueries.upsertResolveThread.mock.calls.filter(
        ([params]) => params.row.state === 'closed',
      );
      expect(closedWrites).toEqual([]);
    });

    it('keeps the Bitbucket thread reads of one mount with six open requests inside the cap', async () => {
      const prs = Array.from({ length: REVIEW_REFRESH_CONCURRENCY + 2 }, (_, index) => ({
        ...openPr,
        id: index + 1,
        webUrl: `${openPr.webUrl}/${index}`,
      }));
      store.setState({
        mountBitbucketPr: {
          [PAYMENTS_MOUNT]: { ...bitbucketEntry({ pr: prs[0] ?? null, fetchedAt: TEST_NOW }), prs },
        },
      });
      let open = 0;
      let peak = 0;
      h.listComments.mockImplementation(async () => {
        open += 1;
        peak = Math.max(peak, open);
        await flush();
        open -= 1;
        return [];
      });

      await store.getState().sweepRequests();

      expect(h.listComments).toHaveBeenCalledTimes(prs.length);
      expect(peak).toBeLessThanOrEqual(REVIEW_REFRESH_CONCURRENCY);
    });

    it('keeps GitHub detail reads of many mounts inside the same cap', async () => {
      const mountIds = Array.from({ length: REVIEW_REFRESH_CONCURRENCY + 2 }, (_, index) =>
        brandId<MountId>({ value: `mount-github-${index}` }),
      );
      store.setState({
        sessionMounts: {
          [SESSION.id]: mountIds.map((id) => mountView({ id, project: LEDGER })),
        },
        mountGithub: Object.fromEntries(
          mountIds.map((id) => [
            id,
            { ...githubEntry({ pr: openGithubPr }), mountId: id, prs: [openGithubPr] },
          ]),
        ),
      });
      let open = 0;
      let peak = 0;
      storySpies.fetchPrDetail.mockImplementation(async () => {
        open += 1;
        peak = Math.max(peak, open);
        await flush();
        open -= 1;
        return { comments: [] };
      });
      const refresh = refreshSessionPrDetail(store.setState, store.getState);

      await Promise.all(mountIds.map((mountId) => refresh(SESSION.id, { mountId, force: true })));

      expect(storySpies.fetchPrDetail).toHaveBeenCalledTimes(mountIds.length);
      expect(peak).toBeLessThanOrEqual(REVIEW_REFRESH_CONCURRENCY);
    });

    it('shows the error on a forced sweep of a host that never answered', async () => {
      h.listDiscussions.mockRejectedValue(new Error('gitlab unreachable'));

      await store.getState().sweepRequests({ sessionId: SESSION.id, isForced: true });

      expect(threadsOf({ key: gitlabKey })?.error).toBe('gitlab unreachable');
    });
  });

  describe('concurrency cap', () => {
    it('starts at most the cap of refreshes before any settles', async () => {
      const extra = Array.from({ length: REVIEW_REFRESH_CONCURRENCY + 2 }, (_, index) =>
        mountView({
          id: brandId<MountId>({ value: `mount-cap-${index}` }),
          project: LEDGER,
        }),
      );
      store.setState({ sessionMounts: { [SESSION.id]: extra } });
      const gates: Array<() => void> = [];
      refreshGithub.mockImplementation(
        () =>
          new Promise<undefined>((resolve) => {
            gates.push(() => resolve(undefined));
          }),
      );

      void store.getState().sweepRequests();
      expect(refreshGithub).toHaveBeenCalledTimes(REVIEW_REFRESH_CONCURRENCY);

      gates[0]?.();
      await flush();
      expect(refreshGithub).toHaveBeenCalledTimes(REVIEW_REFRESH_CONCURRENCY + 1);

      while (gates.length < REVIEW_REFRESH_CONCURRENCY + 2) {
        gates[gates.length - 1]?.();
        await flush();
      }
      for (const release of gates) {
        release();
      }
      await flush();
      expect(refreshGithub).toHaveBeenCalledTimes(REVIEW_REFRESH_CONCURRENCY + 2);
      expect(store.getState().boardReady).toBe(true);
    });
  });
});
