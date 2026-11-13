import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type GitlabIntegrationBinding,
  type IntegrationBindingId,
  type IntegrationCredentialId,
  type MountId,
  type Project,
  type Session,
  type SessionId,
  type SessionMountView,
} from '@goodboy/types';
import { aProject, aSession, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

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
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
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
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../storyHarness')).repoModuleMock(),
);
vi.mock('../../../features/integrations/github/github', async () =>
  (await import('../../storyHarness')).githubModuleMock(),
);
vi.mock('@goodboy/core/github', async (importOriginal) =>
  (await import('../../storyHarness')).coreGithubModuleMock({ importOriginal }),
);

const WORKSPACE = aWorkspace({ name: 'Harborline', slug: 'harborline' });
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
const OPEN_SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Reconcile ledger-core' });
const OTHER_SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Tune notify-relay' });
const LEDGER_MOUNT = brandId<MountId>({ value: 'mount-ledger' });
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

type MountParams = {
  readonly id: MountId;
  readonly project: Project;
  readonly session: Session;
};

const mountView = ({ id, project, session }: MountParams): SessionMountView => ({
  id,
  sessionId: session.id,
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

const refreshGithub = vi.fn(async (_sessionId: SessionId, _options?: unknown) => undefined);
const refreshGitlab = vi.fn(async (_sessionId: SessionId, _options?: unknown) => undefined);
const refreshDetail = vi.fn(async (_sessionId: SessionId, _options?: unknown) => undefined);

let store: StoryStore;
let idleCallbacks: Array<() => void> = [];

const flush = async (): Promise<void> => {
  for (let tick = 0; tick < 400; tick += 1) {
    await Promise.resolve();
  }
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  for (const spy of [refreshGithub, refreshGitlab, refreshDetail]) {
    spy.mockReset();
    spy.mockResolvedValue(undefined);
  }
  idleCallbacks = [];
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
    idleCallbacks.push(callback);
    return idleCallbacks.length;
  });
  store.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    projects: [LEDGER, RELAY],
    sessions: [OTHER_SESSION, OPEN_SESSION],
    currentSessionId: OPEN_SESSION.id,
    sessionMounts: {
      [OPEN_SESSION.id]: [mountView({ id: LEDGER_MOUNT, project: LEDGER, session: OPEN_SESSION })],
      [OTHER_SESSION.id]: [mountView({ id: RELAY_MOUNT, project: RELAY, session: OTHER_SESSION })],
    },
    githubStatus: { mode: 'gh-cli', available: true },
    workspaceIntegrations: { [WORKSPACE.id]: [GITLAB] },
    mountGithub: {},
    mountRequests: {},
    refreshSessionPr: refreshGithub,
    refreshSessionMr: refreshGitlab,
    refreshSessionPrDetail: refreshDetail,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sweepRequests, the current session first', () => {
  it('refreshes the open session now and the others when the app is idle', async () => {
    void store.getState().sweepRequests({ isCurrentFirst: true });
    await flush();

    expect(refreshGithub).toHaveBeenCalledTimes(1);
    expect(refreshGithub).toHaveBeenCalledWith(OPEN_SESSION.id, expect.anything());
    expect(refreshGitlab).not.toHaveBeenCalled();
    expect(idleCallbacks).toHaveLength(1);

    idleCallbacks[0]?.();
    await flush();

    expect(refreshGitlab).toHaveBeenCalledTimes(1);
    expect(refreshGitlab).toHaveBeenCalledWith(OTHER_SESSION.id, expect.anything());
    expect(refreshGithub).toHaveBeenCalledTimes(1);
  });

  it('sweeps every session at once when no session is open', async () => {
    store.setState({ currentSessionId: null });

    void store.getState().sweepRequests({ isCurrentFirst: true });
    await flush();

    expect(refreshGithub).toHaveBeenCalledTimes(1);
    expect(refreshGitlab).toHaveBeenCalledTimes(1);
    expect(idleCallbacks).toHaveLength(0);
  });

  it('keeps one sweep for a named session, with no idle wait', async () => {
    void store.getState().sweepRequests({ sessionId: OTHER_SESSION.id, isCurrentFirst: true });
    await flush();

    expect(refreshGitlab).toHaveBeenCalledWith(OTHER_SESSION.id, expect.anything());
    expect(refreshGithub).not.toHaveBeenCalled();
    expect(idleCallbacks).toHaveLength(0);
  });
});
