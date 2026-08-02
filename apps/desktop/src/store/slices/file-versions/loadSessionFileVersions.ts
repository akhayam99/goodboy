import { listFileVersionsForSession } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { fileVersionsLoadInFlight, type GetFn, type SetFn } from './types';

type Params = Readonly<{
  sessionId: SessionId;
  force?: boolean;
}>;

export const loadSessionFileVersions = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, force = false }: Params): Promise<void> => {
    if (!force && get().sessionFileVersions[sessionId] !== undefined) {
      return;
    }
    if (fileVersionsLoadInFlight.has(sessionId)) {
      return;
    }
    fileVersionsLoadInFlight.add(sessionId);
    set((state) => ({
      sessionFileVersionsLoading: {
        ...state.sessionFileVersionsLoading,
        [sessionId]: true,
      },
    }));
    try {
      const versions = await listFileVersionsForSession({ db: tauriDatabase, sessionId });
      const selected = get().sessionFileVersionSelectedPath[sessionId] ?? null;
      const selectedStillExists =
        selected != null && versions.some((version) => version.relativePath === selected);
      const nextSelected = selectedStillExists ? selected : (versions[0]?.relativePath ?? null);
      set((state) => ({
        sessionFileVersions: {
          ...state.sessionFileVersions,
          [sessionId]: versions,
        },
        sessionFileVersionSelectedPath: {
          ...state.sessionFileVersionSelectedPath,
          [sessionId]: nextSelected,
        },
      }));
    } finally {
      fileVersionsLoadInFlight.delete(sessionId);
      set((state) => ({
        sessionFileVersionsLoading: {
          ...state.sessionFileVersionsLoading,
          [sessionId]: false,
        },
      }));
    }
  };
};
