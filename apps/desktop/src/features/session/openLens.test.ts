import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { sessionPlace } from '../../store/slices/navigation/place';

const { state } = vi.hoisted(() => ({
  state: {
    navigate: vi.fn(),
    setScriptsLensScope: vi.fn(),
  },
}));

vi.mock('../../store', async () => ({
  useAppStore: { getState: () => state },
  sessionPlace: (await import('../../store/slices/navigation/place')).sessionPlace,
}));

import { openLens } from './openLens';

const SESSION_ID = 'sess-1' as SessionId;

const toLens = (lens: Parameters<typeof sessionPlace>[0]['lens']) => ({
  to: sessionPlace({ sessionId: SESSION_ID, lens }),
});

beforeEach(() => {
  state.navigate = vi.fn();
  state.setScriptsLensScope = vi.fn();
});

describe('openLens', () => {
  it('navigates to the lens as a history voice', () => {
    openLens({ sessionId: SESSION_ID, lens: 'review' });
    expect(state.navigate).toHaveBeenCalledWith(toLens('review'));
  });

  it('clears the one-shot scripts scope on the way into scripts', () => {
    openLens({ sessionId: SESSION_ID, lens: 'scripts' });
    expect(state.setScriptsLensScope).toHaveBeenCalledWith({ scope: null });
    expect(state.navigate).toHaveBeenCalledWith(toLens('scripts'));
  });

  it('leaves the scripts scope alone for every other destination', () => {
    openLens({ sessionId: SESSION_ID, lens: 'plans' });
    openLens({ sessionId: SESSION_ID, lens: null });
    expect(state.setScriptsLensScope).not.toHaveBeenCalled();
    expect(state.navigate).toHaveBeenLastCalledWith(toLens(null));
  });
});
