import { describe, expect, it } from 'vitest';
import type { DiffCommentAnchor } from '@goodboy/types';
import { anchorKey } from './lib';

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
