// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const engine = vi.hoisted(() => ({ readHistoryCopyGitDirs: vi.fn() }));
const worktree = vi.hoisted(() => ({
  gitCommonDirectory: vi.fn(async () => '/repos/payments-api/.git'),
}));

vi.mock('../../../features/history/historyEngine', () => engine);
vi.mock('../../../features/worktree/worktree', () => worktree);

import { rewriterWritableRoots } from './rewriterWritableRoots';

const COPY = '/tmp/goodboy-history-mount-1/copy';
const COMMON = '/repos/payments-api/.git';

const isWritable = ({
  roots,
  path,
}: {
  readonly roots: ReadonlyArray<string>;
  readonly path: string;
}): boolean => roots.some((root) => path === root || path.startsWith(`${root}/`));

describe('rewriterWritableRoots', () => {
  beforeEach(() => {
    engine.readHistoryCopyGitDirs.mockResolvedValue({
      gitDir: `${COMMON}/worktrees/copy`,
      objectsDir: `${COMMON}/objects`,
      packedRefsLock: `${COMMON}/packed-refs.lock`,
    });
  });

  it('lets the rewriter write only its copy, its own admin folder and the objects', async () => {
    const roots = await rewriterWritableRoots({ copyPath: COPY });
    expect(isWritable({ roots, path: `${COPY}/src/ledger.ts` })).toBe(true);
    expect(isWritable({ roots, path: `${COMMON}/worktrees/copy/HEAD` })).toBe(true);
    expect(isWritable({ roots, path: `${COMMON}/objects/ab/cdef` })).toBe(true);
    expect(isWritable({ roots, path: `${COMMON}/packed-refs.lock` })).toBe(true);
  });

  it('never lets it write the branch refs, the stash or another checkout', async () => {
    const roots = await rewriterWritableRoots({ copyPath: COPY });
    expect(isWritable({ roots, path: `${COMMON}/refs/heads/hl/ledger-export` })).toBe(false);
    expect(isWritable({ roots, path: `${COMMON}/refs/stash` })).toBe(false);
    expect(isWritable({ roots, path: `${COMMON}/worktrees/ledger-review/HEAD` })).toBe(false);
    expect(isWritable({ roots, path: `${COMMON}/packed-refs` })).toBe(false);
    expect(isWritable({ roots, path: `${COMMON}/logs/refs/heads/hl/ledger-export` })).toBe(false);
    expect(isWritable({ roots, path: `${COMMON}/config` })).toBe(false);
  });

  it('keeps only the copy when its git folders cannot be proven', async () => {
    engine.readHistoryCopyGitDirs.mockResolvedValue(null);
    expect(await rewriterWritableRoots({ copyPath: COPY })).toEqual([COPY]);
  });
});
