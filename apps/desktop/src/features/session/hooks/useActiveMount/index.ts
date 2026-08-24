import type { SessionId, SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Params = {
  readonly sessionId: SessionId;
};

export const useActiveMount = ({ sessionId }: Params): SessionProjectMount | null =>
  useAppStore((state) => {
    const mounts = state.sessionProjectMounts[sessionId];
    if (mounts == null || mounts.length === 0) {
      return null;
    }
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    const activeId = state.sessionActiveProject[sessionId] ?? session?.activeProjectId;
    return mounts.find((mount) => mount.projectId === activeId) ?? mounts[0] ?? null;
  });
