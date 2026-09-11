import { useCallback, useMemo } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useToast } from '../../../app/components/Toast';

type SessionsParams = {
  readonly sessions: ReadonlyArray<Session>;
};

export type SessionArchive = {
  readonly archive: (params: SessionsParams) => Promise<void>;
  readonly restore: (params: SessionsParams) => Promise<void>;
};

export const ARCHIVE_KEPT_COPY = 'Branches, worktrees and history stay on disk.';

export const RESTORE_KEPT_COPY = 'Back on the board, nothing was rebuilt.';

type CountParams = {
  readonly count: number;
};

export const archivedTitle = ({ count }: CountParams): string =>
  count === 1 ? 'Session archived' : `${count} sessions archived`;

export const restoredTitle = ({ count }: CountParams): string =>
  count === 1 ? 'Session restored' : `${count} sessions restored`;

export const useSessionArchive = (): SessionArchive => {
  const bulkArchiveTask = useAppStore((s) => s.bulkArchiveTask);
  const bulkUnarchiveTask = useAppStore((s) => s.bulkUnarchiveTask);
  const { showToast } = useToast();

  const restore = useCallback(
    async ({ sessions }: SessionsParams): Promise<void> => {
      if (sessions.length === 0) {
        return;
      }
      await bulkUnarchiveTask(sessions.map((session) => session.id as SessionId));
      showToast('success', RESTORE_KEPT_COPY, {
        title: restoredTitle({ count: sessions.length }),
      });
    },
    [bulkUnarchiveTask, showToast],
  );

  const archive = useCallback(
    async ({ sessions }: SessionsParams): Promise<void> => {
      if (sessions.length === 0) {
        return;
      }
      await bulkArchiveTask(sessions.map((session) => session.id as SessionId));
      showToast('info', ARCHIVE_KEPT_COPY, {
        title: archivedTitle({ count: sessions.length }),
        action: { label: 'Undo', onClick: () => void restore({ sessions }) },
      });
    },
    [bulkArchiveTask, restore, showToast],
  );

  return useMemo<SessionArchive>(() => ({ archive, restore }), [archive, restore]);
};
