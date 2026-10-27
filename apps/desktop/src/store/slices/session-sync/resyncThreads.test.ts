import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type GitlabIntegrationBinding,
  type IntegrationBindingId,
  type IntegrationCredentialId,
  type MountId,
  type SessionMountView,
} from '@goodboy/types';
import { aProject, aSession, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import type { MountGitlabMrState } from '../gitlab-mr/state';

vi.mock('../../../features/integrations/gitlab/client', async (importOriginal) =>
  (await import('../../storyHarness')).gitlabThreadsClientModuleMock({ importOriginal }),
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
const RELAY = aProject({
  workspaceId: WORKSPACE.id,
  name: 'notify-relay',
  remoteUrl: 'https://gitlab.com/harborline/notify-relay.git',
});
const SESSION = aSession({ workspaceId: WORKSPACE.id });
const RELAY_MOUNT = brandId<MountId>({ value: 'mount-relay' });

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

const mountView: SessionMountView = {
  id: RELAY_MOUNT,
  sessionId: SESSION.id,
  projectId: RELAY.id,
  mountName: RELAY.name,
  worktreePath: '/worktrees/notify-relay',
  lastWorktreePath: null,
  repoRoot: '/repos/notify-relay',
  branch: 'ak/notify-relay',
  baseBranch: 'main',
  parallelIndex: 0,
  repoSlug: null,
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
};

const MR_URL = 'https://gitlab.com/harborline/notify-relay/-/merge_requests';

type MrParams = {
  readonly iid: number;
};

const mrOf = ({ iid }: MrParams): GitlabMergeRequest => ({
  id: 700 + iid,
  iid,
  projectId: 1,
  title: 'Retry notify-relay deliveries',
  description: null,
  state: 'opened',
  webUrl: `${MR_URL}/${iid}`,
  sourceBranch: 'ak/notify-relay',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: TEST_NOW,
  sha: 'a41c9e2b7d3f',
});

const gitlabEntry = ({ iid }: MrParams): MountGitlabMrState => {
  const mr = mrOf({ iid });
  return {
    mountId: RELAY_MOUNT,
    projectId: RELAY.id,
    revision: 1,
    host: 'gitlab.com',
    projectPath: 'harborline/notify-relay',
    branch: 'ak/notify-relay',
    mr,
    mrs: [mr],
    links: [],
    approvals: null,
    fetchedAt: TEST_NOW,
    loading: false,
    error: null,
  };
};

const stubGitlab = ({ iid }: MrParams): void => {
  stubStoryInvoke({
    worktree_remote_url: 'https://gitlab.com/harborline/notify-relay.git',
    worktree_inspect: {
      kind: 'registered',
      path: mountView.worktreePath,
      isMain: false,
      isLocked: false,
      lockReason: null,
    },
    gitlab_mr_for_branch: mrOf({ iid }),
    gitlab_get_mr: mrOf({ iid }),
    gitlab_mr_approval_state: null,
  });
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.gitlabListMrDiscussions.mockReset();
  stubGitlab({ iid: 7 });
  storySpies.listSessionMounts.mockImplementation(async () => [mountView]);
  store.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    projects: [RELAY],
    sessions: [SESSION],
    currentSessionId: SESSION.id,
    sessionMounts: { [SESSION.id]: [mountView] },
    sessionActiveMount: { [SESSION.id]: RELAY_MOUNT },
    sessionActiveProject: { [SESSION.id]: RELAY.id },
    workspaceIntegrations: { [WORKSPACE.id]: [GITLAB] },
    mountGitlabMr: { [RELAY_MOUNT]: gitlabEntry({ iid: 7 }) },
    reviewSourceThreads: {},
  });
});

describe('resyncSession review threads through the real sweep', () => {
  it('rejects with the GitLab thread error and clears the spinner', async () => {
    storySpies.gitlabListMrDiscussions.mockRejectedValue(new Error('gitlab unreachable'));

    await expect(store.getState().resyncSession({ sessionId: SESSION.id })).rejects.toThrow(
      'gitlab unreachable',
    );

    expect(storySpies.gitlabListMrDiscussions).toHaveBeenCalled();
    expect(store.getState().sessionSyncing[SESSION.id]).toBeUndefined();
  });

  it('ignores an old thread error of a request the mount no longer shows', async () => {
    storySpies.gitlabListMrDiscussions.mockResolvedValue([]);
    stubGitlab({ iid: 8 });
    store.setState({
      mountGitlabMr: { [RELAY_MOUNT]: gitlabEntry({ iid: 8 }) },
      reviewSourceThreads: {
        [SESSION.id]: {
          [`${MR_URL}/7`]: {
            comments: [],
            fetchedAt: null,
            loading: false,
            error: 'old merge request failed',
          },
        },
      },
    });

    await expect(
      store.getState().resyncSession({ sessionId: SESSION.id }),
    ).resolves.toBeUndefined();

    expect(store.getState().sessionSyncing[SESSION.id]).toBeUndefined();
  });
});
