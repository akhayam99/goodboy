import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { git, GitError } from './git';
import { sanitizeSlug } from './slug';

export class WorktreeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorktreeError';
  }
}

export type CreateWorktreeOptions = {
  readonly repoPath: string;
  readonly branchPrefix: string;
  readonly slug: string;
  readonly parentDir?: string;
};

export type CreatedWorktree = {
  readonly worktreePath: string;
  readonly branchName: string;
  readonly slug: string;
};

export type WorktreeInfo = {
  readonly path: string;
  readonly branch: string | null;
  readonly head: string;
  readonly isMain: boolean;
};

export const createWorktree = async (opts: CreateWorktreeOptions): Promise<CreatedWorktree> => {
  const slug = sanitizeSlug(opts.slug);
  const branchName = `${opts.branchPrefix}/${slug}`;
  const repoName = path.basename(opts.repoPath);
  const parent = opts.parentDir ?? path.dirname(opts.repoPath);
  const worktreePath = path.join(parent, `${repoName}-${opts.branchPrefix}-${slug}`);

  await ensureBranchAvailable(opts.repoPath, branchName);

  await mkdir(parent, { recursive: true });
  await git(opts.repoPath, ['worktree', 'add', '-b', branchName, worktreePath]);

  return { worktreePath, branchName, slug };
};

export const removeWorktree = async (repoPath: string, worktreePath: string): Promise<void> => {
  await git(repoPath, ['worktree', 'remove', '--force', worktreePath]);
};

export const listWorktrees = async (repoPath: string): Promise<ReadonlyArray<WorktreeInfo>> => {
  const { stdout } = await git(repoPath, ['worktree', 'list', '--porcelain']);
  return parsePorcelain(stdout);
};

async function ensureBranchAvailable(repoPath: string, branchName: string): Promise<void> {
  try {
    await git(repoPath, ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`]);
  } catch (err) {
    if (err instanceof GitError) return;
    throw err;
  }
  throw new WorktreeError(`branch already exists: ${branchName}`);
}

function parsePorcelain(stdout: string): ReadonlyArray<WorktreeInfo> {
  const blocks = stdout.split(/\n\n+/).filter((block) => block.trim().length > 0);
  const entries: WorktreeInfo[] = [];
  let isFirst = true;

  for (const block of blocks) {
    const lines = block.split('\n');
    let worktreePath = '';
    let branch: string | null = null;
    let head = '';

    for (const line of lines) {
      if (line.startsWith('worktree ')) worktreePath = line.slice('worktree '.length);
      else if (line.startsWith('HEAD ')) head = line.slice('HEAD '.length);
      else if (line.startsWith('branch ')) {
        const ref = line.slice('branch '.length);
        branch = ref.replace(/^refs\/heads\//, '');
      } else if (line === 'detached') {
        branch = null;
      }
    }

    if (worktreePath.length > 0) {
      entries.push({ path: worktreePath, branch, head, isMain: isFirst });
      isFirst = false;
    }
  }

  return entries;
}
