import { describe, expect, it } from 'vitest';
import type { BranchCommit } from '@goodboy/types';
import { branchSummaryOf, ROOT_FOLDER } from './branchSummaryOf';

type CommitParams = {
  readonly subject: string;
  readonly isPushed: boolean;
};

const commit = ({ subject, isPushed }: CommitParams): BranchCommit => ({
  sha: `sha-${subject}`,
  shortSha: subject.slice(0, 7),
  subject,
  author: 'Dana Reyes',
  timestamp: 1_700_000_000,
  pushed: isPushed,
  parentSha: null,
});

type FileParams = {
  readonly path: string;
  readonly additions?: number;
  readonly deletions?: number;
  readonly isBinary?: boolean;
};

const file = ({ path, additions = 1, deletions = 0, isBinary = false }: FileParams) => ({
  path,
  additions,
  deletions,
  binary: isBinary,
});

describe('branchSummaryOf', () => {
  it('rolls files up by top folder, biggest first, ties by name', () => {
    const summary = branchSummaryOf({
      commits: [],
      files: [
        file({ path: 'src/a.ts' }),
        file({ path: 'src/b.ts' }),
        file({ path: 'docs/a.md' }),
        file({ path: 'apps/a.ts' }),
        file({ path: 'web/a.ts' }),
        file({ path: 'README.md' }),
      ],
    });
    expect(summary.folders.map((folder) => folder.name)).toEqual([
      'src',
      'apps',
      'docs',
      ROOT_FOLDER,
      'web',
    ]);
    expect(summary.shownFolders.map((folder) => folder.name)).toEqual(['src', 'apps', 'docs']);
    expect(summary.hiddenFolderCount).toBe(2);
    expect(summary.hiddenFolderFiles).toBe(2);
  });

  it('keeps the card count and the folder rollup on the same files', () => {
    const files = [
      file({ path: 'src/a.ts' }),
      file({ path: 'src/b.ts' }),
      file({ path: 'docs/a.md' }),
    ];
    const summary = branchSummaryOf({ commits: [], files });
    expect(summary.fileCount).toBe(files.length);
    expect(summary.folders.reduce((sum, folder) => sum + folder.files, 0)).toBe(files.length);
  });

  it('counts binary files without adding lines', () => {
    const summary = branchSummaryOf({
      commits: [],
      files: [
        file({ path: 'assets/logo.png', additions: 40, deletions: 10, isBinary: true }),
        file({ path: 'src/a.ts', additions: 5, deletions: 2 }),
      ],
    });
    expect(summary.fileCount).toBe(2);
    expect(summary.additions).toBe(5);
    expect(summary.deletions).toBe(2);
  });

  it('reads zero files and zero commits as zeros', () => {
    const summary = branchSummaryOf({ commits: [], files: [] });
    expect(summary.commitCount).toBe(0);
    expect(summary.fileCount).toBe(0);
    expect(summary.folders).toEqual([]);
    expect(summary.hiddenFolderCount).toBe(0);
  });

  it('counts commits, the ones not pushed and the last three subjects', () => {
    const summary = branchSummaryOf({
      commits: [
        commit({ subject: 'one', isPushed: false }),
        commit({ subject: 'two', isPushed: false }),
        commit({ subject: 'three', isPushed: true }),
        commit({ subject: 'four', isPushed: true }),
      ],
      files: [],
    });
    expect(summary.commitCount).toBe(4);
    expect(summary.notPushed).toBe(2);
    expect(summary.latestSubjects).toEqual(['one', 'two', 'three']);
  });
});
