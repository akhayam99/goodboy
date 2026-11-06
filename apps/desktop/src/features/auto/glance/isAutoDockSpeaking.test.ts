// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AutoPhase } from '@goodboy/db';
import { aDelegation, aPlanRow, aView } from '../testing/autoViewFixtures';
import { isAutoDockSpeaking } from './isAutoDockSpeaking';

const speaks = (phase: AutoPhase) => isAutoDockSpeaking({ view: aView({ phase }), rootTurn: null });

describe('isAutoDockSpeaking', () => {
  it('speaks while Auto works and waits for its agents', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [aDelegation({ key: 'impl', role: 'implementer', state: 'running' })],
    });

    expect(isAutoDockSpeaking({ view, rootTurn: null })).toBe(true);
    expect(speaks('delegating')).toBe(true);
  });

  it('speaks while a plan waits for the OK', () => {
    const view = aView({ phase: 'waiting', artifacts: [aPlanRow()] });

    expect(isAutoDockSpeaking({ view, rootTurn: null })).toBe(true);
  });

  it('stays silent on the states the dock does not draw', () => {
    expect(speaks('blocked')).toBe(false);
    expect(speaks('stopped')).toBe(false);
    expect(speaks('finished')).toBe(false);
    expect(speaks('done')).toBe(false);
  });
});
