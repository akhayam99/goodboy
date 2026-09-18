import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    setActiveLens: vi.fn(),
    setScriptsLensScope: vi.fn(),
  },
}));

vi.mock('../../store', () => ({
  useAppStore: { getState: () => state },
}));

import { openLens } from './openLens';

const SESSION_ID = 'sess-1' as SessionId;

beforeEach(() => {
  state.setActiveLens = vi.fn();
  state.setScriptsLensScope = vi.fn();
});

describe('openLens', () => {
  it('sets the lens without toggling when it is already active', () => {
    openLens({ sessionId: SESSION_ID, lens: 'review' });
    expect(state.setActiveLens).toHaveBeenCalledWith(SESSION_ID, 'review');
    openLens({ sessionId: SESSION_ID, lens: 'review' });
    expect(state.setActiveLens).toHaveBeenLastCalledWith(SESSION_ID, 'review');
  });

  it('clears the one-shot scripts scope on the way into scripts', () => {
    openLens({ sessionId: SESSION_ID, lens: 'scripts' });
    expect(state.setScriptsLensScope).toHaveBeenCalledWith({ scope: null });
    expect(state.setActiveLens).toHaveBeenCalledWith(SESSION_ID, 'scripts');
  });

  it('leaves the scripts scope alone for every other destination', () => {
    openLens({ sessionId: SESSION_ID, lens: 'plans' });
    openLens({ sessionId: SESSION_ID, lens: null });
    expect(state.setScriptsLensScope).not.toHaveBeenCalled();
    expect(state.setActiveLens).toHaveBeenLastCalledWith(SESSION_ID, null);
  });
});
