// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { branchPlace, sessionPlace } from '../../store/slices/navigation/place';

const { state } = vi.hoisted(() => {
  const noSession = (): SessionId | null => null;
  return {
    state: {
      navigate: vi.fn(),
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

vi.mock('../actions/dispatchAfterNavigation', () => ({ dispatchAfterNavigation: vi.fn() }));
vi.mock('./openPlaceRows', () => ({ openPlaceRows: vi.fn() }));

import { PLACE_ROWS } from '../../store/slices/navigation/placeRows';
import { dispatchAfterNavigation } from '../actions/dispatchAfterNavigation';
import { linkIssueEventName } from '../actions/kinds/session';
import { openPlaceRows } from './openPlaceRows';
import { openLens } from './openLens';
import { openToolPane } from './panes/openToolPane';

const SESSION_ID = 'sess-1' as SessionId;

const toLens = (lens: Parameters<typeof sessionPlace>[0]['lens']) => ({
  to: sessionPlace({ sessionId: SESSION_ID, lens }),
});

beforeEach(() => {
  state.navigate = vi.fn();
  state.openDrawer = vi.fn();
  state.setExploreMountPath = vi.fn();
});

describe('openLens and openToolPane', () => {
  it('navigates to the lens as a history voice', () => {
    openLens({ sessionId: SESSION_ID, lens: 'review' });
    expect(state.navigate).toHaveBeenCalledWith({
      to: branchPlace({ sessionId: SESSION_ID, tab: 'pr' }),
    });
  });

  it('opens the Scripts pane with no scope, without leaving the current session', () => {
    state.currentSessionId = SESSION_ID;
    openToolPane({ sessionId: SESSION_ID, pane: 'scripts' });
    expect(state.openDrawer).toHaveBeenCalledWith({
      kind: 'scripts',
      sessionId: SESSION_ID,
      payload: null,
    });
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it('opens the Explore pane as the Changes page with every file, from anywhere', () => {
    state.currentSessionId = null;
    openToolPane({ sessionId: SESSION_ID, pane: 'explore' });
    expect(openPlaceRows).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      lens: 'files',
      rows: { [PLACE_ROWS.changesMode]: 'all' },
    });
    expect(state.openDrawer).not.toHaveBeenCalled();
  });

  it('asks Link work from the provider, on the Context tab, with that source in the event', () => {
    openLens({ sessionId: SESSION_ID, lens: 'jira_issues' });
    expect(state.navigate).toHaveBeenCalledWith(toLens('context'));
    expect(dispatchAfterNavigation).toHaveBeenCalledWith({
      name: linkIssueEventName({ sessionId: SESSION_ID }),
      detail: { source: 'jira' },
    });
  });

  it('opens no drawer for every other destination', () => {
    openLens({ sessionId: SESSION_ID, lens: 'plans' });
    openLens({ sessionId: SESSION_ID, lens: null });
    expect(state.openDrawer).not.toHaveBeenCalled();
    expect(state.navigate).toHaveBeenLastCalledWith(toLens(null));
  });
});
