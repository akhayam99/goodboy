import type { ClaudePermissionMode, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';

type Params = {
  readonly sessionId: SessionId;
  readonly mode: ClaudePermissionMode | null;
};

export const applyStartEdits = async ({ sessionId, mode }: Params): Promise<void> => {
  if (mode === null) {
    return;
  }
  await useAppStore.getState().setSessionPermissionMode(sessionId, mode);
};
