// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NAMES } from '../../shared/utils/names';
import { RESOLVE_VOCAB, RESOLVE_WORD_LABEL, applyFixesLabel } from '../resolve/commentProjection';
import { fixLabel, threadCountText } from '../resolve/reviewLaunchCopy';

describe('the push and fix labels come from the word table', () => {
  it('reads Apply from one name, with the count', () => {
    expect(RESOLVE_VOCAB.applyFix).toBe(NAMES.applyFix);
    expect(applyFixesLabel({ count: 1 })).toBe(NAMES.applyFix);
    expect(applyFixesLabel({ count: 7 })).toBe('Apply 7 fixes');
  });

  it('reads a fix that waits for you as Fix ready', () => {
    expect(RESOLVE_WORD_LABEL.to_review).toBe(NAMES.fixReady);
  });

  it('counts the comments a fix covers, never threads', () => {
    expect(threadCountText({ count: 1 })).toBe('1 comment');
    expect(threadCountText({ count: 4 })).toBe('4 comments');
    expect(fixLabel({ count: 3 })).toBe(`${NAMES.fix} 3`);
  });

  it('keeps one name for each job the word table settled', () => {
    expect(NAMES.push).toBe('Push');
    expect(NAMES.rebaseNeedsYou).toBe('The rebase needs you');
    expect(NAMES.fixPushWithAgent).toBe('Fix with an agent');
    expect(NAMES.onOrigin).toBe('On origin');
  });
});
