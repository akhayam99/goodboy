import type { TaskId } from '@kay-am/types';
import type { Database } from '../client';

interface TaskWorktreeRow {
  id: string;
  task_id: string;
  worktree_path: string;
  branch: string;
  parallel_index: number;
  created_at: number;
}

export interface TaskWorktree {
  readonly id: string;
  readonly taskId: TaskId;
  readonly worktreePath: string;
  readonly branch: string;
  readonly parallelIndex: number;
  readonly createdAt: number;
}

function toDomain(row: TaskWorktreeRow): TaskWorktree {
  return {
    id: row.id,
    taskId: row.task_id as TaskId,
    worktreePath: row.worktree_path,
    branch: row.branch,
    parallelIndex: row.parallel_index,
    createdAt: row.created_at,
  };
}

export async function insertTaskWorktree(db: Database, worktree: TaskWorktree): Promise<void> {
  await db.execute(
    `INSERT INTO task_worktrees
      (id, task_id, worktree_path, branch, parallel_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      worktree.id,
      worktree.taskId,
      worktree.worktreePath,
      worktree.branch,
      worktree.parallelIndex,
      worktree.createdAt,
    ],
  );
}

export async function listWorktreesForTask(
  db: Database,
  taskId: TaskId,
): Promise<ReadonlyArray<TaskWorktree>> {
  const rows = await db.select<TaskWorktreeRow>(
    'SELECT * FROM task_worktrees WHERE task_id = ? ORDER BY parallel_index ASC',
    [taskId],
  );
  return rows.map(toDomain);
}

export async function deleteWorktreesForTask(db: Database, taskId: TaskId): Promise<void> {
  await db.execute('DELETE FROM task_worktrees WHERE task_id = ?', [taskId]);
}
