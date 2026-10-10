// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { dirtyTreeLine, dirtyTreeSentence } from './dirtyTreeCopy';

describe('dirtyTreeSentence', () => {
  it('counts the files and tells what to do', () => {
    expect(dirtyTreeSentence({ count: 11 })).toBe(
      '11 files have changes that are not committed. Commit or stash them first.',
    );
  });

  it('keeps one file in the singular', () => {
    expect(dirtyTreeSentence({ count: 1 })).toBe(
      '1 file has changes that are not committed. Commit or stash them first.',
    );
  });
});

describe('dirtyTreeLine', () => {
  it('is the short form of the same count', () => {
    expect(dirtyTreeLine({ count: 11 })).toBe('11 files not committed');
    expect(dirtyTreeLine({ count: 1 })).toBe('1 file not committed');
  });
});
