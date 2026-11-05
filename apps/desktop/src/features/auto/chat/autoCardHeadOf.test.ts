// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aDelegation } from '../testing/autoViewFixtures';
import { autoCardHeadOf } from './autoCardHeadOf';

describe('autoCardHeadOf', () => {
  it('names a planner only cluster Planning and a done one Done', () => {
    const head = autoCardHeadOf({
      delegations: [
        aDelegation({ key: 'planner', role: 'planner', state: 'settled', outcome: 'completed' }),
      ],
    });

    expect(head).toEqual({ name: 'Planning', meta: '1 agent', word: 'Done', isOpen: false });
  });

  it('names a cluster with a writer Building and Running while one agent is open', () => {
    const head = autoCardHeadOf({
      delegations: [
        aDelegation({ key: 'impl', role: 'implementer', state: 'running' }),
        aDelegation({ key: 'test', role: 'tester', state: 'settled', outcome: 'completed' }),
      ],
    });

    expect(head).toEqual({ name: 'Building', meta: '2 agents', word: 'Running', isOpen: true });
  });

  it('falls back to Working for other roles', () => {
    const head = autoCardHeadOf({
      delegations: [
        aDelegation({ key: 'review', role: 'reviewer', state: 'settled', outcome: 'completed' }),
      ],
    });

    expect(head.name).toBe('Working');
  });
});
