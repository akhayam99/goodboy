import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { readHostChanges, type HostChangeReaders } from './readHostChanges';

const PARAMS = {
  sessionId: brandId<SessionId>({ value: 'session-harborline' }),
  worktreePath: '/work/harborline/ledger-core',
  branch: 'ak/ledger-export',
  head: 'def456',
};

type PatchParams = {
  readonly paths: ReadonlyArray<string>;
};

const patchOf = ({ paths }: PatchParams): string =>
  paths.map((path) => `diff --git a/${path} b/${path}\n`).join('');

type Call = Readonly<{ base: string; isFromMergeBase: boolean }>;

type ReadersParams = {
  readonly hostHead: string | null;
  readonly diffs: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly calls: Array<Call>;
};

type DiffParams = {
  readonly base: string;
  readonly isFromMergeBase: boolean;
  readonly diffs: ReadersParams['diffs'];
  readonly calls: Array<Call>;
};

const diffOf = async ({ base, isFromMergeBase, diffs, calls }: DiffParams): Promise<string> => {
  calls.push({ base, isFromMergeBase });
  const paths = diffs[base];
  if (paths === undefined) {
    throw new Error(`unknown revision ${base}`);
  }
  return patchOf({ paths });
};

const readersOf = ({ hostHead, diffs, calls }: ReadersParams): HostChangeReaders => ({
  baseBranchOf: () => 'main',
  remoteHeadOf: async () => hostHead,
  diffRange: async ({ base }) => diffOf({ base, isFromMergeBase: false, diffs, calls }),
  diffFromMergeBase: async ({ base }) => diffOf({ base, isFromMergeBase: true, diffs, calls }),
});

describe('the files a push would send to the host', () => {
  it('diffs the branch head on the host against the commit to push', async () => {
    const calls: Array<Call> = [];
    const readers = readersOf({
      hostHead: 'abc123',
      diffs: { abc123: ['pnpm-lock.yaml', 'src/retry.ts'] },
      calls,
    });

    const changes = await readHostChanges({ readers })(PARAMS);
    expect(changes.paths).toEqual(['pnpm-lock.yaml', 'src/retry.ts']);
    expect(changes.patch).toContain('diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml');
    expect(calls).toEqual([{ base: 'abc123', isFromMergeBase: false }]);
  });

  it('sends nothing new when the host already has the commit', async () => {
    const calls: Array<Call> = [];
    const readers = readersOf({ hostHead: 'def456', diffs: {}, calls });

    expect(await readHostChanges({ readers })(PARAMS)).toEqual({ paths: [], patch: '' });
    expect(calls).toEqual([]);
  });

  it('diffs from the merge base with the base branch when the branch is not on the host', async () => {
    const calls: Array<Call> = [];
    const readers = readersOf({
      hostHead: null,
      diffs: { 'origin/main': ['pnpm-lock.yaml'] },
      calls,
    });

    expect((await readHostChanges({ readers })(PARAMS)).paths).toEqual(['pnpm-lock.yaml']);
    expect(calls).toEqual([{ base: 'origin/main', isFromMergeBase: true }]);
  });

  it('falls back to the merge base when the host head is not in the local repository', async () => {
    const calls: Array<Call> = [];
    const readers = readersOf({ hostHead: 'fff999', diffs: { main: ['Cargo.lock'] }, calls });

    expect((await readHostChanges({ readers })(PARAMS)).paths).toEqual(['Cargo.lock']);
    expect(calls).toEqual([
      { base: 'fff999', isFromMergeBase: false },
      { base: 'origin/main', isFromMergeBase: true },
      { base: 'main', isFromMergeBase: true },
    ]);
  });

  it('fails when there is no base branch to compare with', async () => {
    const readers: HostChangeReaders = {
      ...readersOf({ hostHead: null, diffs: {}, calls: [] }),
      baseBranchOf: () => null,
    };

    await expect(readHostChanges({ readers })(PARAMS)).rejects.toThrow(
      'this mount has no base branch',
    );
  });
});
