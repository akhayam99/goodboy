// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type {
  DiffComment,
  IsoDateTime,
  MountId,
  ProjectId,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import { useAppStore } from '../../../../store/store';
import { useBranchNotes } from './index';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_A = 'project-a' as ProjectId;
const PROJECT_B = 'project-b' as ProjectId;
const MOUNT_A = 'mount-a' as MountId;
const MOUNT_B = 'mount-b' as MountId;
const PATH_A = '/worktrees/ledger-core';
const PATH_B = '/worktrees/notify-relay';

const mountOf = (
  mountId: MountId,
  projectId: ProjectId,
  worktreePath: string,
  branch: string,
): SessionProjectMount => ({
  mountId,
  sessionId: SESSION_ID,
  projectId,
  mountName: branch,
  worktreePath,
  lastWorktreePath: worktreePath,
  repoRoot: worktreePath,
  branch,
  baseBranch: 'main',
  parallelIndex: 1,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const noteOf = (id: string, projectId: ProjectId, branch: string): DiffComment => ({
  id,
  sessionId: SESSION_ID,
  filePath: 'src/ledger.ts',
  body: 'Guard the batch',
  status: 'open',
  authorKind: 'user',
  projectId,
  branch,
  createdAt: '2026-09-25T00:00:00.000Z' as IsoDateTime,
});

beforeEach(() => {
  useAppStore.setState({
    ...useAppStore.getInitialState(),
    sessionMounts: {},
    sessionProjectMounts: {
      [SESSION_ID]: [
        mountOf(MOUNT_A, PROJECT_A, PATH_A, 'fix/a'),
        mountOf(MOUNT_B, PROJECT_B, PATH_B, 'fix/b'),
      ],
    },
    sessionActiveMount: { [SESSION_ID]: MOUNT_A },
    diffMountPath: { [SESSION_ID]: PATH_B },
    diffComments: {
      [SESSION_ID]: [noteOf('note-a', PROJECT_A, 'fix/a'), noteOf('note-b', PROJECT_B, 'fix/b')],
    },
  });
});

describe('useBranchNotes', () => {
  it('scopes the Branch page to the displayed mount while another one is active', () => {
    const { result } = renderHook(() =>
      useBranchNotes({ sessionId: SESSION_ID, scope: 'displayed' }),
    );

    expect(result.current.onBranch.map((note) => note.id)).toEqual(['note-b']);
  });

  it('keeps Session consumers on the active write mount', () => {
    const { result } = renderHook(() => useBranchNotes({ sessionId: SESSION_ID }));

    expect(result.current.onBranch.map((note) => note.id)).toEqual(['note-a']);
  });
});
