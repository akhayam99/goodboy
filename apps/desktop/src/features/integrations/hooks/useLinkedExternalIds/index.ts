import { useShallow } from 'zustand/react/shallow';
import type {
  Session,
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';

type KeyParams = {
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
};

type CollectParams = {
  readonly sessionExternalTasks: Readonly<Record<string, ReadonlyArray<SessionExternalTask>>>;
  readonly providers: ReadonlyArray<SessionExternalTaskProvider>;
  readonly sessions?: ReadonlyArray<Pick<Session, 'id'>>;
};

type Params = Omit<CollectParams, 'sessionExternalTasks'>;

export const linkedTaskKey = ({ provider, externalId }: KeyParams): string =>
  `${provider}:${externalId}`;

export const collectLinkedExternalIds = ({
  sessionExternalTasks,
  providers,
  sessions,
}: CollectParams): ReadonlyMap<string, SessionId> => {
  const linked = new Map<string, SessionId>();
  const sessionIds =
    sessions === undefined
      ? Object.keys(sessionExternalTasks)
      : sessions.map((session) => session.id);
  for (const sessionId of sessionIds) {
    for (const task of sessionExternalTasks[sessionId] ?? []) {
      if (!providers.includes(task.provider)) {
        continue;
      }
      const key = linkedTaskKey({ provider: task.provider, externalId: task.externalId });
      if (linked.has(key)) {
        continue;
      }
      linked.set(key, sessionId as SessionId);
    }
  }
  return linked;
};

export const useLinkedExternalIds = ({
  providers,
  sessions,
}: Params): ReadonlyMap<string, SessionId> =>
  useAppStore(
    useShallow((state) =>
      collectLinkedExternalIds({
        sessionExternalTasks: state.sessionExternalTasks,
        providers,
        sessions,
      }),
    ),
  );
