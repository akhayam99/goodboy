import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { sessionById } from '../../store/slices/sessions/sessionIndex';

type Params = {
  readonly sessionId: SessionId;
};

export const browserWorkspaceOf = ({ sessionId }: Params): WorkspaceId | null =>
  sessionById(useAppStore.getState().sessions, sessionId)?.workspaceId ?? null;
