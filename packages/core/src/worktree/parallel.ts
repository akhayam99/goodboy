import type { TaskId } from '@kay-am/types';

export interface ParallelWorktreeDeps {
  invokeWorktreeCreate: (args: {
    repoPath: string;
    branchPrefix: string;
    slug: string;
    parentDir?: string;
  }) => Promise<{ worktreePath: string; branch: string }>;
  invokeWorktreeRemove: (args: { repoPath: string; worktreePath: string }) => Promise<void>;
  insertTaskWorktree: (args: {
    taskId: TaskId;
    worktreePath: string;
    branch: string;
    parallelIndex: number;
  }) => Promise<void>;
  listWorktreesForTask: (
    taskId: TaskId,
  ) => Promise<ReadonlyArray<{ worktreePath: string; branch: string; parallelIndex: number }>>;
  deleteWorktreesForTask: (taskId: TaskId) => Promise<void>;
}

export interface ParallelWorktreeResult {
  readonly worktreePath: string;
  readonly branch: string;
  readonly parallelIndex: number;
}

/**
 * Splits parentBranch into branchPrefix and base slug.
 * "feat/session-goal" → { prefix: "feat", base: "session-goal" }
 * "main" → { prefix: "kay", base: "main" }
 */
function splitParentBranch(parentBranch: string): { prefix: string; base: string } {
  const slashIdx = parentBranch.indexOf('/');
  if (slashIdx === -1) {
    return { prefix: 'kay', base: parentBranch };
  }
  return {
    prefix: parentBranch.slice(0, slashIdx),
    base: parentBranch.slice(slashIdx + 1),
  };
}

export async function createParallelWorktrees(
  deps: ParallelWorktreeDeps,
  args: {
    taskId: TaskId;
    repoPath: string;
    parentBranch: string;
    n: number;
    slugSeed: string;
  },
): Promise<ReadonlyArray<ParallelWorktreeResult>> {
  const { prefix } = splitParentBranch(args.parentBranch);
  const created: Array<{ worktreePath: string; branch: string; index: number }> = [];

  const tasks = Array.from({ length: args.n }, (_, i) => async () => {
    const slug = `${args.slugSeed}-p${i}`;
    const result = await deps.invokeWorktreeCreate({
      repoPath: args.repoPath,
      branchPrefix: prefix,
      slug,
      parentDir: undefined,
    });
    return { worktreePath: result.worktreePath, branch: result.branch, index: i };
  });

  let settled: PromiseSettledResult<{ worktreePath: string; branch: string; index: number }>[];
  try {
    settled = await Promise.allSettled(tasks.map((t) => t()));
  } catch {
    settled = [];
  }

  const failures: string[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') {
      created.push(r.value);
    } else {
      failures.push(String(r.reason));
    }
  }

  if (failures.length > 0) {
    await rollback(deps, args.repoPath, created);
    throw new Error(
      `createParallelWorktrees: ${failures.length} of ${args.n} failed:\n${failures.join('\n')}`,
    );
  }

  await Promise.all(
    created.map((c) =>
      deps.insertTaskWorktree({
        taskId: args.taskId,
        worktreePath: c.worktreePath,
        branch: c.branch,
        parallelIndex: c.index,
      }),
    ),
  );

  return created
    .sort((a, b) => a.index - b.index)
    .map((c) => ({ worktreePath: c.worktreePath, branch: c.branch, parallelIndex: c.index }));
}

async function rollback(
  deps: ParallelWorktreeDeps,
  repoPath: string,
  created: ReadonlyArray<{ worktreePath: string }>,
): Promise<void> {
  const results = await Promise.allSettled(
    created.map((c) => deps.invokeWorktreeRemove({ repoPath, worktreePath: c.worktreePath })),
  );
  for (const r of results) {
    if (r.status === 'rejected') {
      console.error('[parallel] rollback cleanup failed:', r.reason);
    }
  }
}

export async function removeParallelWorktrees(
  deps: ParallelWorktreeDeps,
  args: { repoPath: string; taskId: TaskId },
): Promise<void> {
  const rows = await deps.listWorktreesForTask(args.taskId);

  const results = await Promise.allSettled(
    rows.map((row) =>
      deps.invokeWorktreeRemove({ repoPath: args.repoPath, worktreePath: row.worktreePath }),
    ),
  );

  for (const r of results) {
    if (r.status === 'rejected') {
      console.error('[parallel] removeParallelWorktrees: removal failed (non-fatal):', r.reason);
    }
  }

  await deps.deleteWorktreesForTask(args.taskId);
}
