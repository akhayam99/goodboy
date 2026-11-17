// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveWordCountText } from './resolveWordCountText';

describe('resolveWordCountText', () => {
  it('counts a state with the word the row shows', () => {
    expect(resolveWordCountText({ word: 'to_review', count: 1 })).toBe('1 fix ready');
    expect(resolveWordCountText({ word: 'to_review', count: 2 })).toBe('2 fixes ready');
    expect(resolveWordCountText({ word: 'question', count: 1 })).toBe('1 question');
    expect(resolveWordCountText({ word: 'question', count: 3 })).toBe('3 questions');
    expect(resolveWordCountText({ word: 'couldnt_fix', count: 2 })).toBe('2 failed');
    expect(resolveWordCountText({ word: 'push_failed', count: 1 })).toBe('1 push failed');
    expect(resolveWordCountText({ word: 'working', count: 2 })).toBe('2 fixing');
    expect(resolveWordCountText({ word: 'ready', count: 4 })).toBe('4 fixed');
  });
});
