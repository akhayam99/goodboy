import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { launchSpecFor } from './launchSpecFor';
import type { InboxRecord } from './types';

export type LinkedSessionIndex = ReadonlyMap<string, SessionId>;

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
  const index = new Map<string, SessionId>();
  for (const sessionId of sessionIds) {
    for (const task of sessionExternalTasks[sessionId] ?? []) {
      for (const key of [taskKey(task), codeKey(task)]) {
        if (!index.has(key)) {
          index.set(key, sessionId);
        }
      }
    }
  }
  return index;
};

type AttachParams = {
  readonly record: InboxRecord;
  readonly linked: LinkedSessionIndex;
};

export const attachLinkedSession = ({ record, linked }: AttachParams): InboxRecord => {
  const task = launchSpecFor({ record })?.externalTask;
  if (task == null) {
    return record;
  }
  const linkedSessionId = linked.get(taskKey(task)) ?? linked.get(codeKey(task)) ?? null;
  if (linkedSessionId === (record.linkedSessionId ?? null)) {
    return record;
  }
  return { ...record, linkedSessionId };
};
