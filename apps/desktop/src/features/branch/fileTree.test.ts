import { describe, expect, it } from 'vitest';
import type { FileDiff } from '@goodboy/types';
import { fileTreeGroups } from './fileTree';

const fileAt = (path: string): FileDiff => ({
  path,
  status: 'modified',
  additions: 1,
  deletions: 0,
  binary: false,
  hunks: [],
});

describe('fileTreeGroups', () => {
  it('groups files by folder, folders and files in name order', () => {
    const groups = fileTreeGroups({
      files: [
        fileAt('src/ledger/ledger.ts'),
        fileAt('src/components/index.tsx'),
        fileAt('src/ledger/csv.ts'),
        fileAt('README.md'),
      ],
    });

    expect(groups.map((group) => group.dir)).toEqual(['', 'src/components', 'src/ledger']);
    expect(groups[2]?.files.map((file) => file.path)).toEqual([
      'src/ledger/csv.ts',
      'src/ledger/ledger.ts',
    ]);
  });

  it('keeps a file at the root in the group with no folder', () => {
    expect(fileTreeGroups({ files: [fileAt('package.json')] })).toEqual([
      { dir: '', files: [fileAt('package.json')] },
    ]);
  });

  it('returns nothing for no files', () => {
    expect(fileTreeGroups({ files: [] })).toEqual([]);
  });
});
