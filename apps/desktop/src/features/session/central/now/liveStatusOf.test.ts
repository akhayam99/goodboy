import { describe, expect, it } from 'vitest';
import { liveStatusOf } from './liveStatusOf';

describe('liveStatusOf', () => {
  it('moves what follows a colon to the reason, so the status stays one short word', () => {
    expect(liveStatusOf({ word: 'Stopped: origin moved', detail: null })).toEqual({
      word: 'Stopped',
      reason: 'Origin moved',
    });
  });

  it('keeps a plain word as it is, with no reason when there is no detail', () => {
    expect(liveStatusOf({ word: 'Working', detail: null })).toEqual({
      word: 'Working',
      reason: null,
    });
  });

  it('drops a detail that only repeats the word', () => {
    expect(liveStatusOf({ word: 'Stopped', detail: 'Stopped' })).toEqual({
      word: 'Stopped',
      reason: null,
    });
  });

  it('keeps the part of the detail that adds to the word', () => {
    expect(
      liveStatusOf({ word: 'Blocked', detail: 'Blocked, tell the agent what to do next' }),
    ).toEqual({ word: 'Blocked', reason: 'Tell the agent what to do next' });
  });

  it('keeps a detail that does not start with the word whole', () => {
    expect(liveStatusOf({ word: 'Needs you', detail: 'Step 2 waits for your go' })).toEqual({
      word: 'Needs you',
      reason: 'Step 2 waits for your go',
    });
  });
});
