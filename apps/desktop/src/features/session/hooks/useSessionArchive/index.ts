import { useCallback, useMemo } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../shared/components/Toast';
import { archiveSessions, restoreSessions, type ArchiveOutcome } from '../../sessionArchive';

type SessionsParams = {
  readonly sessions: ReadonlyArray<Session>;
};

export type SessionArchive = {
  readonly archive: (params: SessionsParams) => Promise<ArchiveOutcome>;
  readonly restore: (params: SessionsParams) => Promise<void>;
};

export const useSessionArchive = (): SessionArchive => {
  const bulkArchiveTask = useAppStore((s) => s.bulkArchiveTask);
  const bulkUnarchiveTask = useAppStore((s) => s.bulkUnarchiveTask);
  const { showToast } = useToast();

  const restore = useCallback(
    async ({ sessions }: SessionsParams) => {
      await restoreSessions({ sessions, bulkArchiveTask, bulkUnarchiveTask, showToast });
    },
    [bulkArchiveTask, bulkUnarchiveTask, showToast],
  );

  const archive = useCallback(
    ({ sessions }: SessionsParams) =>
      archiveSessions({ sessions, bulkArchiveTask, bulkUnarchiveTask, showToast }),
    [bulkArchiveTask, bulkUnarchiveTask, showToast],
  );

  return useMemo<SessionArchive>(() => ({ archive, restore }), [archive, restore]);
};
