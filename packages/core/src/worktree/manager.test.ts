import { mkdtemp, rm, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { git } from './git';
import { createWorktree, listWorktrees, removeWorktree, WorktreeError } from './manager';

async function initRepo(): Promise<string> {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'kayam-wt-')));
  const repo = path.join(dir, 'demo');
  await git(dir, ['init', '--initial-branch=main', repo]);
  await git(repo, ['config', 'user.email', 'test@example.com']);
  await git(repo, ['config', 'user.name', 'Test']);
  await writeFile(path.join(repo, 'README.md'), '# demo\n');
  await git(repo, ['add', '.']);
  await git(repo, ['commit', '-m', 'init']);
  return repo;
}

describe('worktree manager', () => {
  let repoPath = '';

  beforeEach(async () => {
    repoPath = await initRepo();
  });

  afterEach(async () => {
    if (repoPath) {
      await rm(path.dirname(repoPath), { recursive: true, force: true });
    }
  });

  it('create + list + remove round-trip', async () => {
    const created = await createWorktree({
      repoPath,
      branchPrefix: 'kay',
      slug: 'first session',
    });

    expect(created.slug).toBe('first-session');
    expect(created.branchName).toBe('kay/first-session');
    expect(created.worktreePath).toBe(path.join(path.dirname(repoPath), 'demo-kay-first-session'));

    const before = await listWorktrees(repoPath);
    expect(before.some((w) => w.path === created.worktreePath)).toBe(true);

    await removeWorktree(repoPath, created.worktreePath);
    const after = await listWorktrees(repoPath);
    expect(after.some((w) => w.path === created.worktreePath)).toBe(false);
  });

  it('rejects when the branch already exists', async () => {
    await git(repoPath, ['branch', 'kay/taken']);
    await expect(
      createWorktree({ repoPath, branchPrefix: 'kay', slug: 'taken' }),
    ).rejects.toBeInstanceOf(WorktreeError);
  });

  it('honors a custom parent dir', async () => {
    const custom = await realpath(await mkdtemp(path.join(tmpdir(), 'kayam-wt-parent-')));
    const created = await createWorktree({
      repoPath,
      branchPrefix: 'kay',
      slug: 'custom',
      parentDir: custom,
    });
    expect(created.worktreePath.startsWith(custom)).toBe(true);
    await removeWorktree(repoPath, created.worktreePath);
    await rm(custom, { recursive: true, force: true });
  });
});
