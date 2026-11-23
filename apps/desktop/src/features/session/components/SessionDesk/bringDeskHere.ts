import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { NOTHING_CHANGED } from '../../../../store/slices/notifications/errorRecovery';
import { switchSessionFace } from './switchSessionFace';
import { deskHolder } from './useDeskOwner/deskHolder';
import { deskLines } from './useDeskOwner/deskLines';

type Params = {
  readonly sessionId: SessionId;
};

export const bringDeskHere = async ({ sessionId }: Params): Promise<boolean> => {
  try {
    const hold = await deskHolder.hold({ sessionId, isTaken: true });
    deskLines.noteHolder({ sessionId, holder: hold?.holder ?? null });
  } catch (error) {
    void useAppStore.getState().reportError({
      title: "Couldn't bring the Desk to this window",
      error,
      sessionId,
      recovery: NOTHING_CHANGED,
      retry: () => bringDeskHere({ sessionId }),
    });
    return false;
  }
  if (useAppStore.getState().currentSessionId !== sessionId) {
    await deskHolder.release({ sessionId });
    return false;
  }
  deskLines.clear({ sessionId });
  switchSessionFace({ sessionId, face: 'desk' });
  return true;
};
