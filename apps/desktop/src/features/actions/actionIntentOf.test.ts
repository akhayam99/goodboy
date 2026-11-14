import { describe, expect, it } from 'vitest';
import { actionButtonLookOf } from './actionButtonLookOf';
import { actionIntentOf } from './actionIntentOf';

describe('actionIntentOf', () => {
  it.each([
    ['Rebase', 'caution'],
    ['diff.rebase', 'caution'],
    ['Force push', 'caution'],
    ['Remove worktree', 'destructive'],
    ['worktree.remove', 'destructive'],
    ['Delete branch', 'destructive'],
    ['Push', 'primary'],
    ['Review', 'primary'],
    ['Run', 'primary'],
    ['Copy link', 'neutral'],
  ] as const)('maps %s to %s', (verb, intent) => {
    expect(actionIntentOf({ verb })).toBe(intent);
  });
});

describe('actionButtonLookOf', () => {
  it('never fills a caution or destructive verb', () => {
    for (const verb of ['Rebase', 'Remove worktree', 'Discard changes']) {
      expect(actionButtonLookOf({ verb, isNext: true }).variant).toBe('secondary');
    }
  });

  it('fills the next step and outlines the rest', () => {
    expect(actionButtonLookOf({ verb: 'Push', isNext: true })).toEqual({
      intent: 'primary',
      variant: 'primary',
    });
    expect(actionButtonLookOf({ verb: 'Push', isNext: false })).toEqual({
      intent: 'neutral',
      variant: 'secondary',
    });
  });
});
