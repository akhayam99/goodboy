// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IntegrationBindingId,
  IntegrationCredentialId,
  IsoDateTime,
  MountId,
  ProjectId,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';

const h = vi.hoisted(() => ({
  invoke: vi.fn(
    async (_command: string, _args?: Record<string, unknown>): Promise<unknown> => null,
  ),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: h.invoke }));

import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { MountGitlabMrState } from '../../../store/slices/gitlab-mr/state';
import { pullRequestPortFor } from '../../../store/slices/review-source/pullRequestPortFor';
import type { GitlabMergeRequest } from './client';
import { gitlabPortOf } from './gitlabPortOf';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const PROJECT_ID = 'project-payments-api' as ProjectId;
const MOUNT_ID = 'mount-payments-api' as MountId;
const OTHER_MOUNT_ID = 'mount-ledger-core' as MountId;
const STAMP = '2026-10-07T08:00:00.000Z' as IsoDateTime;

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath: '/worktrees/payments-api',
  lastWorktreePath: '/worktrees/payments-api',
  repoRoot: '/repos/payments-api',
  branch: 'hl/fix-duplicate-credit',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const MR: GitlabMergeRequest = {
  id: 4201,
  iid: 42,
  projectId: 9,
  title: 'Stop retried webhooks posting a second credit',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/harborline/payments-api/-/merge_requests/42',
  sourceBranch: MOUNT.branch,
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: STAMP,
};

const ENTRY: MountGitlabMrState = {
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  revision: 1,
  host: 'https://gitlab.com',
  projectPath: 'harborline/payments-api',
  branch: MOUNT.branch,
  mrs: [MR],
  links: [],
  mr: MR,
  fetchedAt: STAMP,
  loading: false,
  error: null,
};

const BINDING = {
  id: 'binding-1' as IntegrationBindingId,
  workspaceId: WORKSPACE_ID,
  projectId: null,
  credentialId: 'credential-1' as IntegrationCredentialId,
  createdAt: STAMP,
  updatedAt: STAMP,
  provider: 'gitlab' as const,
  config: { userName: 'nadia-p', userId: '3', host: 'https://gitlab.com' },
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  h.invoke.mockReset();
  h.invoke.mockImplementation(async () => null);
  useAppStore.setState({
    sessions: [aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    projects: [aProject({ id: PROJECT_ID, name: 'payments-api' })],
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
    sessionGithub: {},
    mountGithub: {},
    workspaceIntegrations: { [WORKSPACE_ID]: [BINDING] },
    mountGitlabMr: { [MOUNT_ID]: ENTRY },
  });
});

const portOf = (extra: { readonly prNumber?: number; readonly mountId?: MountId } = {}) =>
  gitlabPortOf({ get: useAppStore.getState, sessionId: SESSION_ID, ...extra });

describe('gitlabPortOf', () => {
  it('builds the GitLab port on the merge request of the active mount', async () => {
    const port = portOf();

    expect(port?.nouns).toEqual({ long: 'merge request', short: 'MR', numberPrefix: '!' });
    await port?.close();

    expect(h.invoke).toHaveBeenCalledWith(
      'gitlab_update_mr_state',
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        projectId: PROJECT_ID,
        host: 'https://gitlab.com',
        projectPath: 'harborline/payments-api',
        mrIid: 42,
        stateEvent: 'close',
      }),
    );
  });

  it('is the port the single registry hands out for a GitLab session', () => {
    expect(pullRequestPortFor({ get: useAppStore.getState, sessionId: SESSION_ID })).not.toBeNull();
  });

  it('keeps the port of a merge request that ended, so it can be reopened', async () => {
    const closed = { ...MR, state: 'closed' };
    useAppStore.setState({
      mountGitlabMr: { [MOUNT_ID]: { ...ENTRY, mr: closed, mrs: [closed] } },
    });

    await pullRequestPortFor({ get: useAppStore.getState, sessionId: SESSION_ID })?.reopen();

    expect(h.invoke).toHaveBeenCalledWith(
      'gitlab_update_mr_state',
      expect.objectContaining({ mrIid: 42, stateEvent: 'reopen' }),
    );
  });

  it('writes the merge request it is asked for and no other', () => {
    expect(portOf({ prNumber: 42 })).not.toBeNull();
    expect(portOf({ prNumber: 43 })).toBeNull();
  });

  it('looks at the mount it is asked for', () => {
    const second: MountGitlabMrState = {
      ...ENTRY,
      mountId: OTHER_MOUNT_ID,
      mr: { ...MR, iid: 77 },
      mrs: [{ ...MR, iid: 77 }],
    };
    useAppStore.setState({ mountGitlabMr: { [MOUNT_ID]: ENTRY, [OTHER_MOUNT_ID]: second } });

    expect(portOf({ mountId: OTHER_MOUNT_ID, prNumber: 77 })).not.toBeNull();
    expect(portOf({ mountId: MOUNT_ID, prNumber: 42 })).not.toBeNull();
  });

  it('never borrows the merge request of another mount when a mount is named', () => {
    useAppStore.setState({
      sessionProjectMounts: {
        [SESSION_ID]: [MOUNT, { ...MOUNT, mountId: OTHER_MOUNT_ID, mountName: 'ledger-core' }],
      },
      mountGitlabMr: { [MOUNT_ID]: ENTRY },
    });

    expect(portOf({ mountId: OTHER_MOUNT_ID, prNumber: 42 })).toBeNull();
  });

  it('has no port without a connected GitLab', () => {
    useAppStore.setState({ workspaceIntegrations: { [WORKSPACE_ID]: [] } });

    expect(portOf()).toBeNull();
  });

  it('has no port without a merge request on the mount', () => {
    useAppStore.setState({ mountGitlabMr: { [MOUNT_ID]: { ...ENTRY, mr: null, mrs: [] } } });

    expect(portOf()).toBeNull();
  });

  it('has no port before the project of the remote is known', () => {
    useAppStore.setState({ mountGitlabMr: { [MOUNT_ID]: { ...ENTRY, projectPath: null } } });

    expect(portOf()).toBeNull();
  });

  it('has no port for a session that is gone', () => {
    useAppStore.setState({ sessions: [] });

    expect(portOf()).toBeNull();
  });
});
