import { brandId, type SessionId } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import { selectDrawerPanel } from './selectDrawerPanel';
import type { OpenDrawer } from './state';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger-core' });
const OTHER_ID = brandId<SessionId>({ value: 'session-notify-relay' });
const EXPLORE: OpenDrawer = { kind: 'explore', sessionId: SESSION_ID, payload: null };

describe('selectDrawerPanel', () => {
  it('shows the open drawer of the current session while no page is open', () => {
    expect(
      selectDrawerPanel({ drawer: EXPLORE, currentSessionId: SESSION_ID, appStudio: null }),
    ).toBe(EXPLORE);
  });

  it('parks the drawer while a page is open, and keeps it in the state', () => {
    const state: Parameters<typeof selectDrawerPanel>[0] = {
      drawer: EXPLORE,
      currentSessionId: SESSION_ID,
      appStudio: { kind: 'guide' },
    };

    expect(selectDrawerPanel(state)).toBeNull();
    expect(state.drawer).toBe(EXPLORE);
  });

  it('shows nothing for a drawer of another session', () => {
    expect(
      selectDrawerPanel({ drawer: EXPLORE, currentSessionId: OTHER_ID, appStudio: null }),
    ).toBeNull();
  });
});
