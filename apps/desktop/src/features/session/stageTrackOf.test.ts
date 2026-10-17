import { describe, expect, it } from 'vitest';
import { stageTrackOf } from './stageTrackOf';

describe('stageTrackOf', () => {
  it.each([
    ['building', 'neutral', false],
    ['running', 'info', true],
    ['attention', 'warning', false],
    ['review', 'success', false],
    ['done', 'merged', false],
  ] as const)('colors a %s session %s', (stage, tone, isBreathing) => {
    expect(stageTrackOf({ stage, isArchived: false })).toEqual({ tone, isBreathing });
  });

  it('keeps an archived session neutral and still, whatever stage it stopped in', () => {
    expect(stageTrackOf({ stage: 'running', isArchived: true })).toEqual({
      tone: 'neutral',
      isBreathing: false,
    });
  });
});
