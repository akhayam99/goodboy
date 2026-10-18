import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Project, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../../../../store';
import { historyFoldersOf } from '../../../../../../../store/slices/project-mounts/inPlaceFoldersOf';
import type { FolderTurnManifest } from '../../../../../../file-versions/fileVersions';

type Params = Readonly<{ sessionId: SessionId }>;

export type FolderChanges = Readonly<{
  folders: ReadonlyArray<Project>;
  turns: ReadonlyArray<FolderTurnManifest> | undefined;
  loadError: string | null;
  sizeError: string | null;
  reload: () => void;
}>;

export const useFolderChanges = ({ sessionId }: Params): FolderChanges => {
  const folders = useAppStore(useShallow((state) => historyFoldersOf({ state, sessionId })));
  const turns = useAppStore((state) => state.sessionFolderTurns[sessionId]);
  const loadSessionFolderTurns = useAppStore((state) => state.loadSessionFolderTurns);
  const loadFolderHistorySize = useAppStore((state) => state.loadFolderHistorySize);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoadError(null);
    setSizeError(null);
    loadSessionFolderTurns({ sessionId, isForced: true }).catch((error: unknown) => {
      setLoadError(formatError(error));
    });
    for (const folder of folders) {
      loadFolderHistorySize({ folder }).catch((error: unknown) => {
        setSizeError(formatError(error));
      });
    }
  }, [folders, loadFolderHistorySize, loadSessionFolderTurns, sessionId]);

  useEffect(() => {
    reload();
    window.addEventListener('focus', reload);
    return () => window.removeEventListener('focus', reload);
  }, [reload]);

  return { folders, turns, loadError, sizeError, reload };
};
