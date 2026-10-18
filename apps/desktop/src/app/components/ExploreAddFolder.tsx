import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { sessionById } from '../../store/slices/sessions/sessionIndex';
import { MountProjectAction } from '../../features/session/components/SessionOverviewPane/ProjectMountRows/MountProjectAction';

type Props = {
  readonly sessionId: SessionId;
};

export const ExploreAddFolder = ({ sessionId }: Props) => {
  const workspaceId = useAppStore(
    (state) => sessionById(state.sessions, sessionId)?.workspaceId ?? null,
  );
  if (workspaceId === null) {
    return null;
  }
  return (
    <MountProjectAction sessionId={sessionId} workspaceId={workspaceId} presentation="button" />
  );
};
