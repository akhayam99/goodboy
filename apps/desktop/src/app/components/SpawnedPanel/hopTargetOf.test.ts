import { describe, expect, it } from 'vitest';
import { hopTargetOf } from './hopTargetOf';

const IDS = ['agent-planner', 'agent-tester', 'agent-reviewer'];

describe('hopTargetOf', () => {
  it('moves down and up the agents in screen order', () => {
    expect(hopTargetOf({ ids: IDS, current: 'agent-planner', direction: 'next' })).toBe(
      'agent-tester',
    );
    expect(hopTargetOf({ ids: IDS, current: 'agent-reviewer', direction: 'previous' })).toBe(
      'agent-tester',
    );
  });

  it('stops at the ends instead of wrapping', () => {
    expect(hopTargetOf({ ids: IDS, current: 'agent-reviewer', direction: 'next' })).toBeNull();
    expect(hopTargetOf({ ids: IDS, current: 'agent-planner', direction: 'previous' })).toBeNull();
  });

  it('starts from the first agent going down and the last going up when nothing is selected', () => {
    expect(hopTargetOf({ ids: IDS, current: null, direction: 'next' })).toBe('agent-planner');
    expect(hopTargetOf({ ids: IDS, current: 'agent-gone', direction: 'previous' })).toBe(
      'agent-reviewer',
    );
  });

  it('has nowhere to go with no agents', () => {
    expect(hopTargetOf({ ids: [], current: null, direction: 'next' })).toBeNull();
  });
});
