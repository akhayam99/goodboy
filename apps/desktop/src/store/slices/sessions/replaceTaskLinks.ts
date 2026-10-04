import { replaceSessionTaskLinks } from '@goodboy/db';
import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { taskIdentityKey } from '../../../shared/utils/taskIdentityKey';
import type { SliceDeps } from '../../slice-types';

type Params = SliceDeps & {
  readonly sessionId: SessionId;
  readonly task: SessionExternalTask;
  readonly expected: ReadonlyArray<SessionExternalTask>;
  readonly shouldCheckReferences?: boolean;
  readonly next: ReadonlyArray<SessionExternalTask>;
};

export const replaceTaskLinks = async ({
  set,
  get,
  sessionId,
  task,
  expected,
  next,
  shouldCheckReferences = false,
}: Params): Promise<boolean> => {
  const key = taskIdentityKey({ task });
  const current = (get().sessionExternalTasks[sessionId] ?? []).filter(
    (row) => taskIdentityKey({ task: row }) === key,
  );
  if (
    shouldCheckReferences &&
    (current.length !== expected.length || !current.every((row) => expected.includes(row)))
  ) {
    return false;
  }
  const isCommitted = await replaceSessionTaskLinks({ db: tauriDatabase, task, expected, next });
  if (!isCommitted) {
    return false;
  }
  const rows = get().sessionExternalTasks[sessionId] ?? [];
  set((state) => ({
    sessionExternalTasks: {
      ...state.sessionExternalTasks,
      [sessionId]: [...rows.filter((row) => taskIdentityKey({ task: row }) !== key), ...next],
    },
  }));
  return true;
};
