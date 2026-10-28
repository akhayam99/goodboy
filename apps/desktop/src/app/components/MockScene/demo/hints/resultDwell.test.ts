import { describe, expect, it } from 'vitest';
import { DEMO_CHAPTERS } from '../demoChapters';
import { dwellOf } from './dwellOf';
import { RESULT_DWELL_MS } from './resultDwellMs';

const hints = DEMO_CHAPTERS.flatMap((chapter) => chapter.hints);

const hintOf = ({ id }: { readonly id: string }) => {
  const hint = hints.find((entry) => entry.id === id);
  if (hint === undefined) {
    throw new Error(`no hint ${id}`);
  }
  return hint;
};

const HOLDS_A_RESULT = [
  'story-answer',
  'plan-send',
  'plan-approve',
  'fix-rebase',
  'fix-push',
  'storage-remove',
] as const;

describe('the result each action shows before the scene moves on', () => {
  it.each(HOLDS_A_RESULT)('%s keeps its result longer than the default dwell', (id) => {
    expect(dwellOf({ hint: hintOf({ id }) })).toBeGreaterThan(RESULT_DWELL_MS);
  });

  it('keeps every other result on screen for the default dwell', () => {
    for (const hint of hints.filter((entry) => !HOLDS_A_RESULT.some((id) => id === entry.id))) {
      expect(dwellOf({ hint })).toBe(RESULT_DWELL_MS);
    }
  });
});
