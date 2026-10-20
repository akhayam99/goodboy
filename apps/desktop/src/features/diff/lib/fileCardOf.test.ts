import { describe, expect, it } from 'vitest';
import type { FileDiff } from '@goodboy/types';
import { fileCardOf } from './fileCardOf';

const FILE: FileDiff = {
  path: 'ledger-core/src/rows/LedgerRow.tsx',
  status: 'modified',
  additions: 2,
  deletions: 1,
  binary: false,
  hunks: [],
};

describe('fileCardOf', () => {
  it('puts the file name in the title and the folder in a row', () => {
    const card = fileCardOf({ file: FILE });

    expect(card.title).toBe('LedgerRow.tsx');
    expect(card.facts).toEqual([
      { label: 'Status', value: 'Modified' },
      { label: 'Folder', value: 'ledger-core/src/rows' },
    ]);
  });

  it('adds where a renamed file came from', () => {
    const card = fileCardOf({
      file: { ...FILE, status: 'renamed', oldPath: 'ledger-core/src/rows/Row.tsx' },
    });

    expect(card.facts.at(-1)).toEqual({ label: 'From', value: 'ledger-core/src/rows/Row.tsx' });
  });

  it('skips the folder row for a file at the root', () => {
    const card = fileCardOf({ file: { ...FILE, path: 'README.md', status: 'added' } });

    expect(card.facts).toEqual([{ label: 'Status', value: 'Added' }]);
  });
});
