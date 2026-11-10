import { describe, expect, it } from 'vitest';
import { DEMO_CHAPTERS } from '../demoChapters';
import { dwellOf } from './dwellOf';
import { RESULT_DWELL_MS } from './resultDwellMs';

const hints = DEMO_CHAPTERS.flatMap((chapter) => chapter.hints);

describe('the result each action shows before the scene moves on', () => {
  it('holds a result for two seconds', () => {
    expect(RESULT_DWELL_MS).toBe(2000);
  });

  it('keeps every result on screen for the default dwell', () => {
    for (const hint of hints) {
      expect(dwellOf({ hint }), hint.id).toBe(RESULT_DWELL_MS);
    }
  });
});
