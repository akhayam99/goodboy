import { useShallow } from 'zustand/react/shallow';
import type { Session, SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { AppState } from '../../types';

type SessionsParams = {
  readonly sessions: ReadonlyArray<Session>;
};

export const useProjectMountsForSessions = ({
  sessions,
}: SessionsParams): AppState['sessionProjectMounts'] =>
  useAppStore(
    useShallow((state) => {
      const picked: Record<string, ReadonlyArray<SessionProjectMount>> = {};
      for (const session of sessions) {
        const mounts = state.sessionProjectMounts[session.id];
        if (mounts === undefined) {
          continue;
        }
        picked[session.id] = mounts;
      }
      return picked;
    }),
  );
