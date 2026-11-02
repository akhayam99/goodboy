// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type MountId,
  type Project,
  type ProjectId,
  type SessionId,
} from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';

type ListParams = {
  readonly repoPath: string;
  readonly worktreePaths: ReadonlyArray<string>;
};

const h = vi.hoisted(() => ({
  inspections: new Map<string, 'registered' | 'missing'>(),
  listRegisteredWorktrees: vi.fn(),
  updateSessionMountLifecycle: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../../storyHarness')).dbModuleMock({
    getSessionMount: vi.fn(async () => null),
    updateSessionMountLifecycle: h.updateSessionMountLifecycle,
  }),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../../features/worktree/listRegisteredWorktrees', () => ({
  listRegisteredWorktrees: h.listRegisteredWorktrees,
}));

import { verifyWorkspaceWorktrees } from './verifyWorkspaceWorktrees';

const repo = (id: string, rootPath: string, kind: Project['kind'] = 'repo'): Project =>
  aProject({ id: brandId<ProjectId>({ value: id }), rootPath, kind });

type CandidateParams = {
  readonly id: string;
  readonly projectId: string;
  readonly worktreePath: string | null;
};

const candidate = ({ id, projectId, worktreePath }: CandidateParams) => ({
  id,
  projectId: brandId<ProjectId>({ value: projectId }),
  worktreePath,
  revision: 0,
});

const SESSION_A = brandId<SessionId>({ value: 'session-a' });
const SESSION_B = brandId<SessionId>({ value: 'session-b' });

beforeEach(() => {
  vi.clearAllMocks();
  h.inspections.clear();
  h.listRegisteredWorktrees.mockImplementation(async ({ worktreePaths }: ListParams) =>
    worktreePaths.map((path) => {
      const kind = h.inspections.get(path) ?? 'registered';
      return { kind, path, isMain: false, isLocked: false, lockReason: null };
    }),
  );
});

describe('verifyWorkspaceWorktrees', () => {
  it('asks once per repo for every session worktree, in the original order', async () => {
    const projects = [repo('p1', '/repos/ledger-core'), repo('p2', '/repos/notify-relay')];
    const a1 = candidate({ id: 'm1', projectId: 'p1', worktreePath: '/wt/a1' });
    const a2 = candidate({ id: 'm2', projectId: 'p2', worktreePath: '/wt/a2' });
    const a3 = candidate({ id: 'm3', projectId: 'p1', worktreePath: '/wt/a3' });
    const b1 = candidate({ id: 'm4', projectId: 'p1', worktreePath: '/wt/b1' });

    const { availableBySession } = await verifyWorkspaceWorktrees({
      candidatesBySession: new Map([
        [SESSION_A, [a1, a2, a3]],
        [SESSION_B, [b1]],
      ]),
      projects,
    });

    expect(h.listRegisteredWorktrees).toHaveBeenCalledTimes(2);
    expect(h.listRegisteredWorktrees).toHaveBeenCalledWith({
      repoPath: '/repos/ledger-core',
      worktreePaths: ['/wt/a1', '/wt/a3', '/wt/b1'],
    });
    expect(availableBySession.get(SESSION_A)).toEqual([a1, a2, a3]);
    expect(availableBySession.get(SESSION_B)).toEqual([b1]);
  });

  it('marks a missing worktree on its own session and drops it', async () => {
    h.inspections.set('/wt/gone', 'missing');
    const projects = [repo('p1', '/repos/ledger-core')];
    const kept = candidate({ id: 'm1', projectId: 'p1', worktreePath: '/wt/kept' });
    const gone = candidate({ id: 'm2', projectId: 'p1', worktreePath: '/wt/gone' });

    const { availableBySession } = await verifyWorkspaceWorktrees({
      candidatesBySession: new Map([[SESSION_B, [kept, gone]]]),
      projects,
    });

    expect(availableBySession.get(SESSION_B)).toEqual([kept]);
    expect(h.updateSessionMountLifecycle).toHaveBeenCalledTimes(1);
    expect(h.updateSessionMountLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_B,
        mountId: brandId<MountId>({ value: 'm2' }),
        diskState: 'missing',
      }),
    );
  });

  it('keeps non repo mounts without asking git and drops a repo when its listing fails', async () => {
    h.listRegisteredWorktrees.mockRejectedValueOnce(new Error('git unavailable'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const projects = [repo('p1', '/repos/ledger-core'), repo('p2', '/folders/notes', 'folder')];
    const inRepo = candidate({ id: 'm1', projectId: 'p1', worktreePath: '/wt/a' });
    const inFolder = candidate({ id: 'm2', projectId: 'p2', worktreePath: '/folders/notes' });

    const { availableBySession } = await verifyWorkspaceWorktrees({
      candidatesBySession: new Map([[SESSION_A, [inRepo, inFolder]]]),
      projects,
    });

    expect(availableBySession.get(SESSION_A)).toEqual([inFolder]);
    expect(h.updateSessionMountLifecycle).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalledWith('list registered worktrees failed', expect.any(Error));
    logged.mockRestore();
  });
});
