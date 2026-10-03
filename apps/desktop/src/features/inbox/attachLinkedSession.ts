import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { launchSpecFor } from './launchSpecFor';
import type { InboxRecord } from './types';

export type LinkedSessionIndex = ReadonlyMap<string, ReadonlyArray<SessionId>>;

type TaskKeyParams = Pick<SessionExternalTask, 'provider' | 'externalId'>;
type CodeKeyParams = Pick<SessionExternalTask, 'provider' | 'identifier'>;

const taskKey = ({ provider, externalId }: TaskKeyParams): string =>
  `task:${provider}:${externalId}`;

const codeKey = ({ provider, identifier }: CodeKeyParams): string =>
  `code:${provider}:${identifier.trim().toLowerCase()}`;

type IndexParams = {
  readonly sessionIds: ReadonlyArray<SessionId>;
  readonly sessionExternalTasks: Readonly<Record<string, ReadonlyArray<SessionExternalTask>>>;
};

export const indexLinkedSessions = ({
  sessionIds,
  sessionExternalTasks,
}: IndexParams): LinkedSessionIndex => {
  const index = new Map<string, Array<SessionId>>();
  for (const sessionId of sessionIds) {
    for (const task of sessionExternalTasks[sessionId] ?? []) {
      for (const key of [taskKey(task), codeKey(task)]) {
        const sessions = index.get(key) ?? [];
        if (!sessions.includes(sessionId)) {
          index.set(key, [...sessions, sessionId]);
        }
      }
    }
  }
  return index;
};

const sameSessions = (
  left: ReadonlyArray<SessionId> | undefined,
  right: ReadonlyArray<SessionId>,
): boolean =>
  left !== undefined &&
  left.length === right.length &&
  left.every((sessionId, index) => sessionId === right[index]);

type AttachParams = {
  readonly record: InboxRecord;
  readonly linked: LinkedSessionIndex;
};

export const attachLinkedSession = ({ record, linked }: AttachParams): InboxRecord => {
  const task = launchSpecFor({ record })?.externalTask;
  if (task == null) {
    return record;
  }
  const byTask = linked.get(taskKey(task)) ?? [];
  const byCode = linked.get(codeKey(task)) ?? [];
  const linkedSessionIds = [
    ...byTask,
    ...byCode.filter((sessionId) => !byTask.includes(sessionId)),
  ];
  const linkedSessionId = linkedSessionIds[0] ?? null;
  if (
    linkedSessionId === (record.linkedSessionId ?? null) &&
    (linkedSessionIds.length === 0 || sameSessions(record.linkedSessionIds, linkedSessionIds))
  ) {
    return record;
  }
  return {
    ...record,
    linkedSessionId,
    ...(linkedSessionIds.length === 0 ? {} : { linkedSessionIds }),
  };
};
