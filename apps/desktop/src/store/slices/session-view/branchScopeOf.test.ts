// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';
import type { MountGitlabMrState } from '../gitlab-mr/state';
import { brandedId } from '../../../features/history/testing/brandedId';
import { branchScopeOf } from './branchScopeOf';

const SESSION_ID = brandedId<SessionId>({ value: 'session-ledger' });
const PROJECT_ID = brandedId<ProjectId>({ value: 'project-ledger-core' });
const WRITE_MOUNT_ID = brandedId<MountId>({ value: 'mount-ledger-rates' });
const SHOWN_MOUNT_ID = brandedId<MountId>({ value: 'mount-ledger-fees' });
const STAMP = brandedId<IsoDateTime>({ value: '2026-10-07T08:00:00.000Z' });

type MountParams = {
  readonly mountId: MountId;
  readonly branch: string;
  readonly parallelIndex: number;
};

const mountOf = ({ mountId, branch, parallelIndex }: MountParams): SessionProjectMount => ({
  mountId,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'ledger-core',
  worktreePath: `/worktrees/${branch}`,
  lastWorktreePath: `/worktrees/${branch}`,
  repoRoot: '/repos/ledger-core',
  branch,
  baseBranch: null,
  parallelIndex,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const WRITE_MOUNT = mountOf({ mountId: WRITE_MOUNT_ID, branch: 'hl/feat-rates', parallelIndex: 0 });
const SHOWN_MOUNT = mountOf({ mountId: SHOWN_MOUNT_ID, branch: 'hl/feat-fees', parallelIndex: 1 });

const MR: GitlabMergeRequest = {
  id: 5101,
  iid: 51,
  projectId: 9,
  title: 'Round rates half to even',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/northwind/ledger-core/-/merge_requests/51',
  sourceBranch: WRITE_MOUNT.branch,
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: STAMP,
};

const ENTRY: MountGitlabMrState = {
  mountId: WRITE_MOUNT_ID,
  projectId: PROJECT_ID,
  revision: 1,
  host: 'https://gitlab.com',
  projectPath: 'northwind/ledger-core',
  branch: WRITE_MOUNT.branch,
  mrs: [MR],
  links: [],
  mr: MR,
  approvals: null,
  fetchedAt: STAMP,
  loading: false,
  error: null,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [
      aSession({
        id: SESSION_ID,
        workspaceId: brandedId<WorkspaceId>({ value: 'workspace-northwind' }),
      }),
    ],
    projects: [aProject({ id: PROJECT_ID, name: 'ledger-core' })],
    sessionActiveMount: { [SESSION_ID]: WRITE_MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    sessionProjectMounts: { [SESSION_ID]: [WRITE_MOUNT, SHOWN_MOUNT] },
    sessionGithub: {},
    mountGitlabMr: { [WRITE_MOUNT_ID]: ENTRY },
  });
});

type ScopeParams = {
  readonly mountId: MountId | null;
};

const scopeOf = ({ mountId }: ScopeParams) =>
  branchScopeOf({ state: useAppStore.getState(), sessionId: SESSION_ID, mountId });

describe('branchScopeOf', () => {
  it('reads the request of the shown branch, not the write destination', () => {
    expect(scopeOf({ mountId: SHOWN_MOUNT_ID }).state).toBe('none');
    expect(scopeOf({ mountId: WRITE_MOUNT_ID }).state).toBe('open');
  });

  it('falls back to the write destination with no shown branch', () => {
    expect(scopeOf({ mountId: null }).state).toBe('open');
  });
});
