import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { ScriptsPanel } from './ScriptsPanel';

type Props = {
  readonly sessionId: SessionId;
  readonly onClose: () => void;
};

export const SessionScriptsDrawer = ({ sessionId, onClose }: Props) => {
  const workspaceId = useAppStore(
    (state) => sessionById(state.sessions, sessionId)?.workspaceId ?? null,
  );
  if (workspaceId === null) {
    return null;
  }
  return <ScriptsPanel workspaceId={workspaceId} sessionId={sessionId} onClose={onClose} />;
};
