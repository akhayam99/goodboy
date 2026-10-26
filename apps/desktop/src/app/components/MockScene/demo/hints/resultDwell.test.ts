import { describe, expect, it, vi } from 'vitest';
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

const HOLDS_A_RESULT = ['board-open', 'auto-child', 'diff-note', 'review-push'] as const;

describe('the result each action shows before the scene moves on', () => {
  it.each(HOLDS_A_RESULT)('%s keeps its result longer than the default dwell', (id) => {
    expect(dwellOf({ hint: hintOf({ id }) })).toBeGreaterThan(RESULT_DWELL_MS);
  });

  it('keeps the result of the step that left the content open lit', () => {
    for (const id of ['board-open', 'library-reports', 'report-open', 'diff-note']) {
      expect(hintOf({ id }).isDimmed).toBe(false);
    }
  });

  it('closes the limits popover once its result has been read', () => {
    const peek = hintOf({ id: 'agent-limits-peek' });
    const outside = vi.fn();
    document.body.addEventListener('pointerdown', outside);
    peek.settle?.({ root: document });
    document.body.removeEventListener('pointerdown', outside);
    expect(outside).toHaveBeenCalledTimes(1);
  });
});
