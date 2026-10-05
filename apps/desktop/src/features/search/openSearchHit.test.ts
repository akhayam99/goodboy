// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DiffComment,
  IsoDateTime,
  MountId,
  ProjectId,
  SearchHit,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { useAppStore } from '../../store/store';
import { openSearchHit } from './openSearchHit';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_ID = 'project-1' as ProjectId;
const MOUNT_A = 'mount-a' as MountId;
const MOUNT_B = 'mount-b' as MountId;
const PATH_A = '/worktrees/ledger-core-a';
const PATH_B = '/worktrees/ledger-core-b';

const mountOf = (mountId: MountId, worktreePath: string, branch: string): SessionProjectMount => ({
  mountId,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'ledger-core',
  worktreePath,
  lastWorktreePath: worktreePath,
  repoRoot: '/repos/ledger-core',
  branch,
  baseBranch: 'main',
  parallelIndex: 1,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const noteOf = (id: string, assignment: Partial<DiffComment>): DiffComment => ({
  id,
  sessionId: SESSION_ID,
  filePath: 'src/ledger.ts',
  body: 'Guard the batch',
  status: 'open',
  authorKind: 'user',
  createdAt: '2026-09-25T00:00:00.000Z' as IsoDateTime,
  ...assignment,
});

const hitOf = (commentId: string): SearchHit => ({
  docId: `comment:${commentId}`,
  kind: 'comment',
  refId: commentId,
  workspaceId: null,
  sessionId: SESSION_ID,
  sessionTitle: 'Guard the settlement batch',
  agentId: null,
  agentName: null,
  mountId: null,
  provider: null,
  container: null,
  status: null,
  ordinal: null,
  url: null,
  isArchived: false,
  occurredAt: '2026-09-25T00:00:00.000Z' as IsoDateTime,
  title: [{ text: 'Guard the batch', isMatch: false }],
  snippet: [],
});

const displayedPath = (): string | null => useAppStore.getState().diffMountPath[SESSION_ID] ?? null;

beforeEach(() => {
  useAppStore.setState({
    ...useAppStore.getInitialState(),
    sessions: [aSession({ id: SESSION_ID })],
    sessionMounts: {},
    sessionProjectMounts: {
      [SESSION_ID]: [mountOf(MOUNT_A, PATH_A, 'fix/a'), mountOf(MOUNT_B, PATH_B, 'fix/b')],
    },
    sessionActiveMount: { [SESSION_ID]: MOUNT_A },
    diffMountPath: { [SESSION_ID]: PATH_A },
    diffComments: {
      [SESSION_ID]: [
        noteOf('on-b', { projectId: PROJECT_ID, branch: 'fix/b' }),
        noteOf('on-gone', { projectId: PROJECT_ID, branch: 'fix/gone' }),
        noteOf('legacy', {}),
      ],
    },
  });
});

describe('opening a comment search hit', () => {
  it('lands on the branch the comment belongs to, not the one on screen', async () => {
    const opened = await openSearchHit({ hit: hitOf('on-b'), query: 'batch' });

    expect(opened).toBe(true);
    expect(displayedPath()).toBe(PATH_B);
  });

  it('lands on the session overview for a comment written before notes had a branch', async () => {
    const opened = await openSearchHit({ hit: hitOf('legacy'), query: 'batch' });

    expect(opened).toBe(true);
    expect(displayedPath()).toBeNull();
  });

  it('reports a miss when the branch of the comment is no longer in the session', async () => {
    await expect(openSearchHit({ hit: hitOf('on-gone'), query: 'batch' })).resolves.toBe(false);
  });

  it('reports a miss when the comment is gone', async () => {
    await expect(openSearchHit({ hit: hitOf('missing'), query: 'batch' })).resolves.toBe(false);
  });
});
