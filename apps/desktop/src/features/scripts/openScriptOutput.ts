import type { MountId, SessionId } from '@goodboy/types';
import { sessionPlace, useAppStore } from '../../store';

type Params = {
  readonly sessionId: SessionId;
  readonly scriptKey: string;
  readonly mountId: MountId | null;
};

export const openScriptOutput = ({ sessionId, scriptKey, mountId }: Params): void => {
  const state = useAppStore.getState();
  if (state.currentSessionId !== sessionId) {
    state.navigate({ to: sessionPlace({ sessionId }) });
  }
  useAppStore.getState().openDrawer({
    kind: 'scriptRun',
    sessionId,
    payload: { scriptKey, mountId },
  });
};
