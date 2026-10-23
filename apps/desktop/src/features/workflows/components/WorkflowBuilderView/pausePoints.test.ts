import { describe, expect, it } from 'vitest';
import { pausePointsOf } from './pausePoints';

describe('pausePointsOf', () => {
  it('pauses after every step but the last with Every step', () => {
    expect(pausePointsOf({ autonomy: 'step', kinds: ['scout', 'planner', 'implementer'] })).toEqual(
      [
        { afterIndex: 0, text: 'Waits for you to continue' },
        { afterIndex: 1, text: 'Waits for you to continue' },
      ],
    );
  });

  it('pauses once after the plan with After the plan', () => {
    expect(pausePointsOf({ autonomy: 'plan', kinds: ['scout', 'planner', 'implementer'] })).toEqual(
      [{ afterIndex: 1, text: 'Waits for you to approve the plan' }],
    );
  });

  it('does not pause with Never', () => {
    expect(pausePointsOf({ autonomy: 'run', kinds: ['scout', 'planner', 'implementer'] })).toEqual(
      [],
    );
  });

  it('has no plan to approve when no step plans or the plan is last', () => {
    expect(pausePointsOf({ autonomy: 'plan', kinds: ['debugger', 'implementer'] })).toEqual([]);
    expect(pausePointsOf({ autonomy: 'plan', kinds: ['scout', 'planner'] })).toEqual([]);
  });

  it('has nothing to pause on an empty or single-step run with Every step', () => {
    expect(pausePointsOf({ autonomy: 'step', kinds: [] })).toEqual([]);
    expect(pausePointsOf({ autonomy: 'step', kinds: ['scout'] })).toEqual([]);
  });
});
