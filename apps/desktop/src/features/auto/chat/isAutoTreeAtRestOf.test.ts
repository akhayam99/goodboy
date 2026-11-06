// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aDelegation, aPlanRow, aView } from '../testing/autoViewFixtures';
import { isAutoTreeAtRestOf } from './isAutoTreeAtRestOf';

describe('isAutoTreeAtRestOf', () => {
  it('rests once the tree answered with nothing to ask', () => {
    expect(isAutoTreeAtRestOf({ view: aView({ phase: 'answering' }) })).toBe(true);
    expect(isAutoTreeAtRestOf({ view: aView({ phase: 'finished' }) })).toBe(true);
  });

  it('does not rest while agents run', () => {
    expect(isAutoTreeAtRestOf({ view: aView({ phase: 'waiting' }) })).toBe(false);
  });

  it('does not rest while a plan waits for approval, so Review changes stays out', () => {
    const view = aView({ phase: 'answering', artifacts: [aPlanRow()] });

    expect(isAutoTreeAtRestOf({ view })).toBe(false);
  });

  it('does not rest while a project ask is open, so Review changes stays out', () => {
    const view = aView({
      phase: 'answering',
      pendingRefusal: { action: 'delegate', code: 'mount_missing', roles: ['implementer'] },
    });

    expect(isAutoTreeAtRestOf({ view })).toBe(false);
  });

  it('does not rest while a next step waits for your go, so Review changes stays out', () => {
    const view = aView({
      phase: 'answering',
      delegations: [aDelegation({ key: 'impl', role: 'implementer', state: 'awaiting_confirm' })],
    });

    expect(isAutoTreeAtRestOf({ view })).toBe(false);
  });
});
