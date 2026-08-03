import { describe, expect, it } from 'vitest';
import type { BranchCommit, IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { resolverFileCommits } from './resolverFileCommits';

const RUN = 'run-1' as ProviderRunId;

const edit = ({ path, at }: { readonly path: string; readonly at: string }): TurnEvent => ({
  kind: 'file_edit',
  runId: RUN,
  path,
  editType: 'modify',
  at: at as IsoDateTime,
});

const report = ({
  threadId,
  sha,
  at,
}: {
  readonly threadId: string;
  readonly sha: string;
  readonly at: string;
}): TurnEvent => ({
  kind: 'assistant_text',
  runId: RUN,
  delta: `<<comment-resolved threadId="${threadId}" commitSha="${sha}" />>`,
  at: at as IsoDateTime,
});

const commit = ({ sha }: { readonly sha: string }): BranchCommit => ({
  sha,
  shortSha: sha.slice(0, 7),
  subject: 'fix: something',
  author: 'agent',
  timestamp: 1,
  pushed: false,
  parentSha: null,
});

const TWO_THREADS: ReadonlyArray<TurnEvent> = [
  edit({ path: 'src/a.ts', at: '2026-07-25T09:01:00.000Z' }),
  report({ threadId: 'PRRT_1', sha: 'aaa1111', at: '2026-07-25T09:02:00.000Z' }),
  edit({ path: 'src/b.ts', at: '2026-07-25T09:03:00.000Z' }),
  report({ threadId: 'PRRT_2', sha: 'bbb2222', at: '2026-07-25T09:04:00.000Z' }),
];

describe('resolverFileCommits', () => {
  it('gives each file the commit of the thread it was fixed for', () => {
    const byFile = resolverFileCommits({
      events: TWO_THREADS,
      commits: [],
      shaByThreadId: {},
    });

    expect(byFile['src/a.ts']).toBe('aaa1111');
    expect(byFile['src/b.ts']).toBe('bbb2222');
  });

  it('reads the sha the thread settled on rather than the one it first reported', () => {
    const byFile = resolverFileCommits({
      events: TWO_THREADS,
      commits: [],
      shaByThreadId: { PRRT_2: 'amended2' },
    });

    expect(byFile['src/b.ts']).toBe('amended2');
  });

  it('resolves a short reported sha to the commit the branch carries', () => {
    const byFile = resolverFileCommits({
      events: TWO_THREADS,
      commits: [commit({ sha: 'aaa1111ffffffff' })],
      shaByThreadId: {},
    });

    expect(byFile['src/a.ts']).toBe('aaa1111ffffffff');
  });

  it('sends a file edited after the last report to the newest commit', () => {
    const byFile = resolverFileCommits({
      events: [...TWO_THREADS, edit({ path: 'src/c.ts', at: '2026-07-25T09:05:00.000Z' })],
      commits: [],
      shaByThreadId: {},
    });

    expect(byFile['src/c.ts']).toBe('bbb2222');
  });

  it('gives every file the same sha when a single thread reported once', () => {
    const byFile = resolverFileCommits({
      events: [
        edit({ path: 'src/a.ts', at: '2026-07-25T09:01:00.000Z' }),
        edit({ path: 'src/b.ts', at: '2026-07-25T09:01:30.000Z' }),
        report({ threadId: 'PRRT_1', sha: 'aaa1111', at: '2026-07-25T09:02:00.000Z' }),
      ],
      commits: [],
      shaByThreadId: {},
    });

    expect(byFile).toEqual({ 'src/a.ts': 'aaa1111', 'src/b.ts': 'aaa1111' });
  });

  it('attributes nothing when the resolver reported no commit', () => {
    const byFile = resolverFileCommits({
      events: [edit({ path: 'src/a.ts', at: '2026-07-25T09:01:00.000Z' })],
      commits: [commit({ sha: 'aaa1111ffffffff' })],
      shaByThreadId: {},
    });

    expect(byFile).toEqual({});
  });
});
