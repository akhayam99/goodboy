// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { branchPlace, sessionPlace } from '../../store/slices/navigation/place';

const { state } = vi.hoisted(() => {
  const noSession = (): SessionId | null => null;
  return {
    state: {
      navigate: vi.fn(),
      setScriptsLensScope: vi.fn(),
      openDrawer: vi.fn(),
      setExploreMountPath: vi.fn(),
      currentSessionId: noSession(),
    },
  };
});

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
  state.openDrawer = vi.fn();
  state.setExploreMountPath = vi.fn();
});

describe('openLens', () => {
  it('navigates to the lens as a history voice', () => {
    openLens({ sessionId: SESSION_ID, lens: 'review' });
    expect(state.navigate).toHaveBeenCalledWith({
      to: branchPlace({ sessionId: SESSION_ID, tab: 'pr' }),
    });
  });

  it('opens the Scripts pane with no scope, without leaving the current session', () => {
    state.currentSessionId = SESSION_ID;
    openLens({ sessionId: SESSION_ID, lens: 'scripts' });
    expect(state.setScriptsLensScope).toHaveBeenCalledWith({ scope: null });
    expect(state.openDrawer).toHaveBeenCalledWith({
      kind: 'scripts',
      sessionId: SESSION_ID,
      payload: null,
    });
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it('goes to the session first when the Explore pane is asked from elsewhere', () => {
    state.currentSessionId = null;
    openLens({ sessionId: SESSION_ID, lens: 'explore' });
    expect(state.navigate).toHaveBeenCalledWith(toLens(null));
    expect(state.openDrawer).toHaveBeenCalledWith({
      kind: 'explore',
      sessionId: SESSION_ID,
      payload: null,
    });
  });

  it('leaves the scripts scope alone for every other destination', () => {
    openLens({ sessionId: SESSION_ID, lens: 'plans' });
    openLens({ sessionId: SESSION_ID, lens: null });
    expect(state.setScriptsLensScope).not.toHaveBeenCalled();
    expect(state.navigate).toHaveBeenLastCalledWith(toLens(null));
  });
});
