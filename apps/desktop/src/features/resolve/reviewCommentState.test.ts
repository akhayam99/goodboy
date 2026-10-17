import { describe, expect, it } from 'vitest';
import {
  REVIEW_COMMENT_NODE,
  REVIEW_COMMENT_TONE,
  reviewCommentStateOf,
  reviewCommentToneKeyOf,
  reviewCommentWord,
} from './reviewCommentState';
import { STATE_CHIP_TONE, STATE_WORD_TONE } from './components/ReviewFlow/stateTone';
import { queueRowAt } from './testing/queueRow';

describe('review comment words', () => {
  it('says Left open for a parked thread and To review for a proposed one', () => {
    const skipped = queueRowAt({ stage: 'parked' });
    const proposed = queueRowAt({ stage: 'proposed' });
    expect(reviewCommentWord({ state: reviewCommentStateOf({ row: skipped }), row: skipped })).toBe(
      'Left open',
    );
    expect(
      reviewCommentWord({ state: reviewCommentStateOf({ row: proposed }), row: proposed }),
    ).toBe('Fix ready');
  });

  it('keeps To review for an edited reply and says Question for an asking thread', () => {
    const proposed = queueRowAt({ stage: 'proposed' });
    expect(reviewCommentStateOf({ row: proposed, isEdited: true })).toBe('edited');
    expect(reviewCommentWord({ state: 'edited', row: proposed })).toBe('Fix ready');
    const asking = queueRowAt({ stage: 'asking' });
    expect(reviewCommentWord({ state: reviewCommentStateOf({ row: asking }), row: asking })).toBe(
      'Question for you',
    );
  });

  it('tells a push that failed from a fix run that could not fix', () => {
    const push = queueRowAt({ stage: 'failed', failedStep: 'push' });
    const run = queueRowAt({ stage: 'failed', failedStep: 'run' });
    expect(reviewCommentWord({ state: 'failed', row: push })).toBe('Push failed');
    expect(reviewCommentWord({ state: 'failed', row: run })).toBe('Failed');
    expect(reviewCommentToneKeyOf({ state: 'failed', row: push })).toBe('push_failed');
    expect(reviewCommentToneKeyOf({ state: 'failed', row: run })).toBe('failed');
  });
});

describe('review state tones', () => {
  it('draws every state word muted, the tone living only on the glyph', () => {
    for (const tone of Object.values(STATE_WORD_TONE)) {
      expect(tone).not.toMatch(/warning|danger|success|info/);
    }
  });

  it("draws Couldn't fix as a warning everywhere and a failed push as the only red", () => {
    expect(REVIEW_COMMENT_TONE.failed).toBe('warning');
    expect(REVIEW_COMMENT_TONE.push_failed).toBe('danger');
    expect(STATE_CHIP_TONE.failed).toBe('warning');
    expect(STATE_CHIP_TONE.push_failed).toBe('danger');
    expect(REVIEW_COMMENT_NODE.failed).not.toBe(REVIEW_COMMENT_NODE.push_failed);
  });

  it('reads every proposal that waits for your Accept as a warning, and a sent one as neutral', () => {
    for (const state of ['ready', 'edited', 'outdated'] as const) {
      expect(REVIEW_COMMENT_TONE[state]).toBe('warning');
    }
    expect(REVIEW_COMMENT_TONE.pushed).toBe('neutral');
    expect(REVIEW_COMMENT_TONE.accepted).toBe('success');
  });
});
