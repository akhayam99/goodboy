import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import type { TerminalTabId } from '../../../shared/types/terminal';
import { BOARD_PLACE } from '../navigation/place';
import { backAfterPlace } from './backAfterPlace';
import type { OpenDrawer } from './state';

const S1 = brandId<SessionId>({ value: 'session-ledger-core' });
const S2 = brandId<SessionId>({ value: 'session-notify-relay' });

const terminal = ({
  sessionId,
  tab,
}: {
  readonly sessionId: SessionId;
  readonly tab: string;
}): OpenDrawer => ({
  kind: 'terminal',
  sessionId,
  payload: { terminalId: brandId<TerminalTabId>({ value: tab }) },
});

describe('backAfterPlace', () => {
  it('keeps another terminal out of the back slot of a terminal', () => {
    const restored = terminal({ sessionId: S1, tab: 'tab-ledger-dev' });
    const back = backAfterPlace({
      state: { drawer: terminal({ sessionId: S2, tab: 'tab-notify-dev' }), drawerBack: null },
      place: BOARD_PLACE,
      drawer: restored,
    });
    expect(back).toBeNull();
  });

  it('keeps a browser behind a terminal', () => {
    const browser: OpenDrawer = { kind: 'browser', sessionId: S1, payload: null };
    const back = backAfterPlace({
      state: { drawer: browser, drawerBack: null },
      place: BOARD_PLACE,
      drawer: terminal({ sessionId: S1, tab: 'tab-ledger-dev' }),
    });
    expect(back).toEqual(browser);
  });
});
