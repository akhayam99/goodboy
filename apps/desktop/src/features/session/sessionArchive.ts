import { useAppStore } from '../../store/store';
import type { Session, SessionId } from '@goodboy/types';
import type { ShowToast } from '../../shared/components/Toast';
import type { AppStore } from '../../store/store';
import {
  SESSION_ARCHIVED_TITLE,
  SESSION_RESTORED_TITLE,
} from './timeline/sessionEventPresentation';

const ARCHIVE_KEPT_COPY = 'Branches, worktrees and history stay on disk.';

const RESTORE_KEPT_COPY = 'Back on the board, nothing was rebuilt.';

type CountParams = {
  readonly count: number;
};

const archivedTitle = ({ count }: CountParams): string =>
  count === 1 ? SESSION_ARCHIVED_TITLE : `${count} sessions archived`;

const restoredTitle = ({ count }: CountParams): string =>
  count === 1 ? SESSION_RESTORED_TITLE : `${count} sessions restored`;

type SessionArchivePorts = {
  readonly bulkArchiveTask: AppStore['bulkArchiveTask'];
  readonly bulkUnarchiveTask: AppStore['bulkUnarchiveTask'];
  readonly showToast: ShowToast;
};

type LifecycleParams = SessionArchivePorts & {
  readonly sessions: ReadonlyArray<Session>;
};

export const restoreSessions = async ({
  sessions,
  bulkUnarchiveTask,
  showToast,
}: LifecycleParams): Promise<void> => {
  if (sessions.length === 0) {
    return;
  }
  const { succeeded } = await bulkUnarchiveTask(sessions.map((session) => session.id as SessionId));
  if (succeeded.length === 0) {
    return;
  }
  showToast({
    kind: 'success',
    message: RESTORE_KEPT_COPY,
    title: restoredTitle({ count: succeeded.length }),
  });
};

export const archiveSessions = async (params: LifecycleParams): Promise<void> => {
  const { sessions, bulkArchiveTask, showToast } = params;
  if (sessions.length === 0) {
    return;
  }
  const { succeeded } = await bulkArchiveTask(sessions.map((session) => session.id as SessionId));
  if (succeeded.length === 0) {
    return;
  }
  const archived = sessions.filter((session) => succeeded.includes(session.id as SessionId));
  useAppStore.getState().undoable({
    showToast,
    message: ARCHIVE_KEPT_COPY,
    title: archivedTitle({ count: archived.length }),
    undo: () => restoreSessions({ ...params, sessions: archived }),
  });
};
