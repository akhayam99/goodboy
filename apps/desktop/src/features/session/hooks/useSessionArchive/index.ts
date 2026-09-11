import { useCallback, useMemo } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import {
  SESSION_ARCHIVED_TITLE,
  SESSION_RESTORED_TITLE,
} from '../../timeline/sessionEventPresentation';

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
  count === 1 ? SESSION_ARCHIVED_TITLE : `${count} sessions archived`;

export const restoredTitle = ({ count }: CountParams): string =>
  count === 1 ? SESSION_RESTORED_TITLE : `${count} sessions restored`;

export const useSessionArchive = (): SessionArchive => {
  const bulkArchiveTask = useAppStore((s) => s.bulkArchiveTask);
  const bulkUnarchiveTask = useAppStore((s) => s.bulkUnarchiveTask);
  const { showToast } = useToast();

  const restore = useCallback(
    async ({ sessions }: SessionsParams): Promise<void> => {
      if (sessions.length === 0) {
        return;
      }
      const { succeeded } = await bulkUnarchiveTask(
        sessions.map((session) => session.id as SessionId),
      );
      if (succeeded.length === 0) {
        return;
      }
      showToast('success', RESTORE_KEPT_COPY, {
        title: restoredTitle({ count: succeeded.length }),
      });
    },
    [bulkUnarchiveTask, showToast],
  );

  const archive = useCallback(
    async ({ sessions }: SessionsParams): Promise<void> => {
      if (sessions.length === 0) {
        return;
      }
      const { succeeded } = await bulkArchiveTask(
        sessions.map((session) => session.id as SessionId),
      );
      if (succeeded.length === 0) {
        return;
      }
      const archived = sessions.filter((session) => succeeded.includes(session.id as SessionId));
      showToast('info', ARCHIVE_KEPT_COPY, {
        title: archivedTitle({ count: archived.length }),
        action: { label: 'Undo', onClick: () => void restore({ sessions: archived }) },
      });
    },
    [bulkArchiveTask, restore, showToast],
  );

  return useMemo<SessionArchive>(() => ({ archive, restore }), [archive, restore]);
};
