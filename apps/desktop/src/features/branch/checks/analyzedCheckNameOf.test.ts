import { describe, expect, it } from 'vitest';
import type { TurnEvent } from '@goodboy/types';
import { analyzedCheckNameOf } from './analyzedCheckNameOf';

const kickoffOf = (text: string): TurnEvent => ({ kind: 'user_text', text }) as TurnEvent;

describe('analyzedCheckNameOf', () => {
  it('reads the check name from the kickoff line', () => {
    const events = [kickoffOf('Pull request #318\nCheck: lint\nlog')];
    expect(analyzedCheckNameOf({ events })).toBe('lint');
  });

  it('returns null without a kickoff or a check line', () => {
    expect(analyzedCheckNameOf({ events: [] })).toBeNull();
    expect(analyzedCheckNameOf({ events: [kickoffOf('nothing here')] })).toBeNull();
  });
});
