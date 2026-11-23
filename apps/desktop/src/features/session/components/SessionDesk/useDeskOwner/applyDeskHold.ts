import { brandId, type SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { currentWindowLabel } from '../../../../workspace/window';
import { focusDeskControl } from '../focusDeskControl';
import type { DeskHold } from './deskHolder';
import { deskLines, type DeskLine } from './deskLines';

type Params = {
  readonly hold: DeskHold;
  readonly line: Extract<DeskLine, 'open-elsewhere' | 'moved'>;
};

export const applyDeskHold = ({ hold, line }: Params): void => {
  const sessionId = brandId<SessionId>({ value: hold.sessionId });
  deskLines.noteHolder({ sessionId, holder: hold.holder });
  const shown = deskLines.lineOf({ sessionId });
  if (hold.holder === null || hold.holder === currentWindowLabel()) {
    if (shown === 'open-elsewhere' || shown === 'moved') {
      deskLines.clear({ sessionId });
    }
    return;
  }
  const state = useAppStore.getState();
  if (state.currentSessionId !== sessionId || state.sessionFace[sessionId] !== 'desk') {
    return;
  }
  state.setSessionFace({ sessionId, face: 'overview' });
  deskLines.show({ sessionId, line: shown === 'moved' ? shown : line });
  focusDeskControl();
};
