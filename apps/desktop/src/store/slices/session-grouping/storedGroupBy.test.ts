// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { nextSessionId } from '@goodboy/types/testing';
import { selectGroupBy } from './selectGroupBy';
import { storedGroupBy } from './storedGroupBy';

const SESSION = nextSessionId();
const OTHER = nextSessionId();

afterEach(() => {
  localStorage.clear();
});

describe('the remembered grouping of a session', () => {
  it('reads back what was written, for that session only', () => {
    storedGroupBy.write({ sessionId: SESSION, groupBy: 'state' });

    expect(storedGroupBy.read({ sessionId: SESSION })).toBe('state');
    expect(storedGroupBy.read({ sessionId: OTHER })).toBeNull();
  });

  it('is what a fresh store opens on, until the person chooses again', () => {
    storedGroupBy.write({ sessionId: SESSION, groupBy: 'state' });
    const stored = storedGroupBy.read({ sessionId: SESSION });

    expect(
      selectGroupBy({ state: { groupBySession: {} }, sessionId: SESSION, branchCount: 3, stored }),
    ).toBe('state');
    expect(
      selectGroupBy({
        state: { groupBySession: { [SESSION]: 'branch' } },
        sessionId: SESSION,
        branchCount: 3,
        stored,
      }),
    ).toBe('branch');
  });

  it('ignores a saved value it does not know and a session with one branch', () => {
    localStorage.setItem(`goodboy:session-grouping:v1:${SESSION}`, 'sideways');
    expect(storedGroupBy.read({ sessionId: SESSION })).toBeNull();

    expect(
      selectGroupBy({
        state: { groupBySession: {} },
        sessionId: SESSION,
        branchCount: 1,
        stored: 'branch',
      }),
    ).toBe('state');
  });

  it('is forgotten with the session', () => {
    storedGroupBy.write({ sessionId: SESSION, groupBy: 'state' });

    storedGroupBy.forget({ sessionId: SESSION });

    expect(storedGroupBy.read({ sessionId: SESSION })).toBeNull();
  });
});
