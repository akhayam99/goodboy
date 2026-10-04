import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../storyHarness';
import { resolveForkBranchName } from './resolveMountNaming';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

const SESSION_ID = 'session-ledger-export' as SessionId;
const SESSION = aSession({ id: SESSION_ID, goal: 'Reconcile the ledger export' });
const PROJECT = aProject({ name: 'ledger-core' });

let useAppStore: StoryStore;

const forkName = (params: { taken?: ReadonlyArray<string>; id?: string; title?: string }) =>
  resolveForkBranchName({
    get: useAppStore.getState,
    session: SESSION,
    project: PROJECT,
    taken: params.taken ?? [],
    ...(params.id !== undefined ? { taskIdentifier: params.id } : {}),
    ...(params.title !== undefined ? { taskTitle: params.title } : {}),
  });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [SESSION],
    sessionProjectMounts: {
      [SESSION_ID]: [
        {
          projectId: PROJECT.id as ProjectId,
          mountName: 'ledger-core',
          worktreePath: '/tmp/ledger-export',
          repoRoot: '/tmp/ledger-core',
          branch: 'mq/ledger-export',
          mountId: 'mount-ledger' as MountId,
          sessionId: SESSION_ID,
          lastWorktreePath: null,
          baseBranch: null,
          parallelIndex: 0,
          isAttached: true,
          diskState: 'present',
          revision: 0,
        },
      ],
    },
  });
});

describe('resolveForkBranchName', () => {
  it('names a task worktree after the task, not after the session branch', () => {
    const name = forkName({ id: 'HBL-412', title: 'Duplicate credit on redelivery' });

    expect(name).toContain('hbl-412');
    expect(name).toContain('duplicate-credit-on-redelivery');
    expect(name).not.toContain('ledger-export');
  });

  it('adds an ordinal when the task branch name is taken', () => {
    const first = forkName({ id: 'HBL-412', title: 'Duplicate credit' });

    const second = forkName({ id: 'HBL-412', title: 'Duplicate credit', taken: [first] });

    expect(second).not.toBe(first);
    expect(second.endsWith('-2')).toBe(true);
  });

  it('falls back to the session branch when no task is given', () => {
    expect(forkName({ taken: ['mq/ledger-export'] })).toBe('mq/ledger-export-2');
  });
});
