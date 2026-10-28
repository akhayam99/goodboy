// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { DEMO_CHAPTERS } from '../demoChapters';

const MAX_WORDS = 16;

const SPEC_PHRASES = [
  'setup advances',
  'the chat records',
  'marked ready',
  'remains open',
  'prepared text',
  'is selected',
] as const;

const hints = DEMO_CHAPTERS.flatMap((chapter) => chapter.hints);

const wordsOf = (text: string): number => text.split('**').join('').split(/\s+/).length;

describe('the step copy', () => {
  it('has a result for every step that reads as visitor copy', () => {
    expect(hints.length).toBeGreaterThan(0);
    for (const hint of hints) {
      expect(wordsOf(hint.result), hint.id).toBeLessThanOrEqual(MAX_WORDS);
      for (const phrase of SPEC_PHRASES) {
        expect(hint.result.toLowerCase(), hint.id).not.toContain(phrase);
      }
    }
  });

  it('keeps every instruction short', () => {
    for (const hint of hints) {
      expect(wordsOf(hint.instruction), hint.id).toBeLessThanOrEqual(MAX_WORDS);
    }
  });
});
