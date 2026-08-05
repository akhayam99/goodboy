import { describe, expect, it } from 'vitest';
import type { DiffCommentAnchor, DiffHunkLine } from '@goodboy/types';
import { anchorKey, lineAnchor } from './lib';

const makeLine = (over: Partial<DiffHunkLine> = {}): DiffHunkLine => ({
  kind: 'context',
  oldLine: null,
  newLine: null,
  text: '',
  ...over,
});

describe('lineAnchor', () => {
  it('anchors a deletion to the old side', () => {
    expect(lineAnchor(makeLine({ kind: 'del', oldLine: 10 }))).toEqual({
      side: 'old',
      lineNumber: 10,
    });
  });

  it('returns null for a deletion with no old line number', () => {
    expect(lineAnchor(makeLine({ kind: 'del', oldLine: null }))).toBeNull();
  });

  it('anchors an addition to the new side', () => {
    expect(lineAnchor(makeLine({ kind: 'add', newLine: 7 }))).toEqual({
      side: 'new',
      lineNumber: 7,
    });
  });

  it('anchors a context line to the new side', () => {
    expect(lineAnchor(makeLine({ kind: 'context', newLine: 3 }))).toEqual({
      side: 'new',
      lineNumber: 3,
    });
  });

  it('returns null for a line with no new line number', () => {
    expect(lineAnchor(makeLine({ kind: 'add', newLine: null }))).toBeNull();
  });
});

describe('anchorKey', () => {
  it('joins side and line for the old side', () => {
    const anchor: DiffCommentAnchor = { side: 'old', lineNumber: 5 };
    expect(anchorKey(anchor)).toBe('old:5');
  });

  it('joins side and line for the new side', () => {
    const anchor: DiffCommentAnchor = { side: 'new', lineNumber: 42 };
    expect(anchorKey(anchor)).toBe('new:42');
  });
});
