import { describe, expect, it, vi } from 'vitest';
import type { TaskId } from '@kay-am/types';
import {
  createParallelWorktrees,
  removeParallelWorktrees,
  type ParallelWorktreeDeps,
} from '../parallel';

const SESSION_ID = 'sess-abc' as TaskId;

function makeDeps(overrides: Partial<ParallelWorktreeDeps> = {}): ParallelWorktreeDeps {
  return {
    invokeWorktreeCreate: vi.fn(async (args) => ({
      worktreePath: `/tmp/repo-${args.branchPrefix}-${args.slug}`,
      branch: `${args.branchPrefix}/${args.slug}`,
    })),
    invokeWorktreeRemove: vi.fn(async () => undefined),
    insertTaskWorktree: vi.fn(async () => undefined),
    listWorktreesForTask: vi.fn(async () => []),
    deleteWorktreesForTask: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('createParallelWorktrees', () => {
  it('happy path n=3: creates 3 worktrees concurrently and persists DB rows', async () => {
    const deps = makeDeps();
    const result = await createParallelWorktrees(deps, {
      taskId: SESSION_ID,
      repoPath: '/tmp/repo',
      parentBranch: 'feat/session-goal',
      n: 3,
      slugSeed: 'session-goal',
    });

    expect(result).toHaveLength(3);
    expect(deps.invokeWorktreeCreate).toHaveBeenCalledTimes(3);

    for (let i = 0; i < 3; i++) {
      expect(deps.invokeWorktreeCreate).toHaveBeenCalledWith({
        repoPath: '/tmp/repo',
        branchPrefix: 'feat',
        slug: `session-goal-p${i}`,
        parentDir: undefined,
      });
    }

    expect(result.map((r) => r.parallelIndex)).toEqual([0, 1, 2]);
    expect(result.at(0)!.branch).toBe('feat/session-goal-p0');
    expect(result.at(1)!.branch).toBe('feat/session-goal-p1');
    expect(result.at(2)!.branch).toBe('feat/session-goal-p2');

    expect(deps.insertTaskWorktree).toHaveBeenCalledTimes(3);
    expect(deps.insertTaskWorktree).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: SESSION_ID, parallelIndex: 0 }),
    );
  });

  it('uses "kay" prefix when parentBranch has no slash', async () => {
    const deps = makeDeps();
    await createParallelWorktrees(deps, {
      taskId: SESSION_ID,
      repoPath: '/tmp/repo',
      parentBranch: 'main',
      n: 1,
      slugSeed: 'my-seed',
    });

    expect(deps.invokeWorktreeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ branchPrefix: 'kay', slug: 'my-seed-p0' }),
    );
  });

  it('rollback on partial failure: removes successful worktrees and throws', async () => {
    let callCount = 0;
    const deps = makeDeps({
      invokeWorktreeCreate: vi.fn(async (args) => {
        callCount++;
        if (callCount === 2) throw new Error('create failed');
        return {
          worktreePath: `/tmp/repo-${args.branchPrefix}-${args.slug}`,
          branch: `${args.branchPrefix}/${args.slug}`,
        };
      }),
    });

    await expect(
      createParallelWorktrees(deps, {
        taskId: SESSION_ID,
        repoPath: '/tmp/repo',
        parentBranch: 'feat/work',
        n: 3,
        slugSeed: 'work',
      }),
    ).rejects.toThrow('createParallelWorktrees');

    expect(deps.invokeWorktreeRemove).toHaveBeenCalledTimes(2);
    expect(deps.insertTaskWorktree).not.toHaveBeenCalled();
  });
});

describe('removeParallelWorktrees', () => {
  it('removes all rows and cleans DB', async () => {
    const rows = [
      { worktreePath: '/tmp/repo-p0', branch: 'feat/x-p0', parallelIndex: 0 },
      { worktreePath: '/tmp/repo-p1', branch: 'feat/x-p1', parallelIndex: 1 },
    ];
    const deps = makeDeps({
      listWorktreesForTask: vi.fn(async () => rows),
    });

    await removeParallelWorktrees(deps, { repoPath: '/tmp/repo', taskId: SESSION_ID });

    expect(deps.invokeWorktreeRemove).toHaveBeenCalledTimes(2);
    expect(deps.invokeWorktreeRemove).toHaveBeenCalledWith({
      repoPath: '/tmp/repo',
      worktreePath: '/tmp/repo-p0',
    });
    expect(deps.deleteWorktreesForTask).toHaveBeenCalledWith(SESSION_ID);
  });

  it('idempotent: no-op when session has no worktrees', async () => {
    const deps = makeDeps({
      listWorktreesForTask: vi.fn(async () => []),
    });

    await removeParallelWorktrees(deps, { repoPath: '/tmp/repo', taskId: SESSION_ID });

    expect(deps.invokeWorktreeRemove).not.toHaveBeenCalled();
    expect(deps.deleteWorktreesForTask).toHaveBeenCalledWith(SESSION_ID);
  });

  it('tolerates individual removal failures (non-fatal) and still deletes DB rows', async () => {
    const rows = [
      { worktreePath: '/tmp/repo-p0', branch: 'feat/x-p0', parallelIndex: 0 },
      { worktreePath: '/tmp/repo-p1', branch: 'feat/x-p1', parallelIndex: 1 },
    ];
    const deps = makeDeps({
      listWorktreesForTask: vi.fn(async () => rows),
      invokeWorktreeRemove: vi.fn(async (_args) => {
        throw new Error('fs error');
      }),
    });

    await expect(
      removeParallelWorktrees(deps, { repoPath: '/tmp/repo', taskId: SESSION_ID }),
    ).resolves.toBeUndefined();

    expect(deps.deleteWorktreesForTask).toHaveBeenCalledWith(SESSION_ID);
  });

  it('listWorktreesForTask ordering: all paths removed regardless of input order', async () => {
    const rows = [
      { worktreePath: '/tmp/repo-p2', branch: 'feat/x-p2', parallelIndex: 2 },
      { worktreePath: '/tmp/repo-p0', branch: 'feat/x-p0', parallelIndex: 0 },
      { worktreePath: '/tmp/repo-p1', branch: 'feat/x-p1', parallelIndex: 1 },
    ];
    const deps = makeDeps({
      listWorktreesForTask: vi.fn(async () => rows),
    });

    await removeParallelWorktrees(deps, { repoPath: '/tmp/repo', taskId: SESSION_ID });

    expect(deps.invokeWorktreeRemove).toHaveBeenCalledTimes(3);
    const paths = (deps.invokeWorktreeRemove as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => (c[0] as { worktreePath: string }).worktreePath,
    );
    expect(paths).toContain('/tmp/repo-p0');
    expect(paths).toContain('/tmp/repo-p1');
    expect(paths).toContain('/tmp/repo-p2');
  });
});
