import { describe, expect, it } from 'vitest';
import { stopsLevelOf } from './stopsLevelOf';

describe('stopsLevelOf', () => {
  it('gives one level when workflows and the Lead stop at the same point', () => {
    expect(stopsLevelOf({ autonomy: 'run', autoLevel: 'run' })).toEqual({
      kind: 'same',
      level: 'run',
    });
  });

  it('keeps both levels when they differ, so nothing changes until you pick', () => {
    expect(stopsLevelOf({ autonomy: 'step', autoLevel: 'plan' })).toEqual({
      kind: 'split',
      workflow: 'step',
      lead: 'plan',
    });
  });

  it('reads a value never saved as the default runs use today', () => {
    expect(stopsLevelOf({ autonomy: null, autoLevel: null })).toEqual({
      kind: 'split',
      workflow: 'step',
      lead: 'plan',
    });
    expect(stopsLevelOf({ autonomy: 'plan', autoLevel: null })).toEqual({
      kind: 'same',
      level: 'plan',
    });
    expect(stopsLevelOf({ autonomy: null, autoLevel: 'step' })).toEqual({
      kind: 'same',
      level: 'step',
    });
  });
});
