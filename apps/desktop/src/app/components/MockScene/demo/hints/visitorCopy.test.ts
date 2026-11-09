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

const WAITS_ON_A_SCRIPT = [
  'story-answer',
  'plan-send',
  'plan-approve',
  'fix-start',
  'fix-rebase',
  'fix-push',
  'storage-remove',
] as const;

const hints = DEMO_CHAPTERS.flatMap((chapter) => chapter.hints);

type WordsParams = {
  readonly text: string;
};

const wordsOf = ({ text }: WordsParams): number => text.split('**').join('').split(/\s+/).length;

describe('the step copy', () => {
  it('has a result for every step that reads as visitor copy', () => {
    expect(hints.length).toBeGreaterThan(0);
    for (const hint of hints) {
      expect(wordsOf({ text: hint.result }), hint.id).toBeLessThanOrEqual(MAX_WORDS);
      for (const phrase of SPEC_PHRASES) {
        expect(hint.result.toLowerCase(), hint.id).not.toContain(phrase);
      }
    }
  });

  it.each(WAITS_ON_A_SCRIPT)('names the work while %s runs', (id) => {
    const hint = hints.find((entry) => entry.id === id);
    expect(hint?.progressCopy ?? '').not.toBe('');
    expect(hint?.progress ?? '').not.toBe('');
  });

  it('keeps every instruction short', () => {
    for (const hint of hints) {
      expect(wordsOf({ text: hint.instruction }), hint.id).toBeLessThanOrEqual(MAX_WORDS);
    }
  });

  it('bridges the push to the storage beat', () => {
    const push = hints.find((hint) => hint.id === 'fix-push');
    expect(push?.result).toBe(
      "Pushed. nadia-p's thread is resolved. Next, free the space you no longer need.",
    );
  });

  it('puts the storage callout above the selection bar', () => {
    expect(hints.find((hint) => hint.id === 'storage-remove')?.side).toBe('top');
  });
});
