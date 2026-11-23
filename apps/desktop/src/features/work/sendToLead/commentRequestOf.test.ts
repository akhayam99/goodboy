// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type MountId,
  type ProjectId,
  type SessionId,
  type SessionMountView,
} from '@goodboy/types';
import type { GitlabMergeRequest } from '../../integrations/gitlab/client';
import { STORE_IMPORT_TIMEOUT_MS, importStore, type StoryStore } from '../../../store/storyHarness';
import { commentRequestOf } from './commentRequestOf';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const SESSION = brandId<SessionId>({ value: 'session-hbl-417' });
const MOUNT = brandId<MountId>({ value: 'mount-notify-relay' });
const STAMP = brandId<IsoDateTime>({ value: '2026-09-04T14:20:00.000Z' });
const GITLAB_URL = 'https://example.invalid/harborline/notify-relay/-/merge_requests/57';

const MOUNT_VIEW: SessionMountView = {
  id: MOUNT,
  sessionId: SESSION,
  projectId: brandId<ProjectId>({ value: 'project-notify-relay' }),
  worktreePath: '/repos/notify-relay',
  lastWorktreePath: null,
  branch: 'hl/relay-retry',
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: 'notify-relay',
  repoSlug: 'harborline/notify-relay',
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: STAMP,
  updatedAt: STAMP,
  repoRoot: '/repos/notify-relay',
};

const MR: GitlabMergeRequest = {
  id: 1,
  iid: 57,
  projectId: 1,
  title: 'Retry on 503',
  description: null,
  state: 'opened',
  webUrl: GITLAB_URL,
  sourceBranch: 'hl/relay-retry',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: '2026-09-04T14:20:00.000Z',
};

describe('commentRequestOf', () => {
  it('reads the merge request of a GitLab comment and the branch of its mount', () => {
    useAppStore.setState({
      sessionMounts: { [SESSION]: [MOUNT_VIEW] },
      sessionRequests: {
        [SESSION]: { kind: 'gitlab', mr: MR, fetchedAt: null, loading: false, error: null },
      },
      reviewSourceKeys: { [SESSION]: 'gitlab:session:57' },
    });

    expect(
      commentRequestOf({ state: useAppStore.getState(), sessionId: SESSION, mountId: MOUNT }),
    ).toEqual({
      branch: 'hl/relay-retry',
      prNumber: 57,
      prUrl: GITLAB_URL,
    });
  });
});
