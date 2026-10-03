import type { SessionExternalTask } from '@goodboy/types';
import { ongoingKey } from './ongoingKey';

const NO_SESSION_IDS: ReadonlyArray<string> = [];

type Params = {
  readonly sessionExternalTasks: Readonly<Record<string, ReadonlyArray<SessionExternalTask>>>;
  readonly filter: string | null;
};

export const sessionsOnOngoingTask = ({
  sessionExternalTasks,
  filter,
}: Params): ReadonlyArray<string> =>
  filter === null
    ? NO_SESSION_IDS
    : Object.entries(sessionExternalTasks)
        .filter(([, tasks]) => tasks.some((task) => ongoingKey({ task }) === filter))
        .map(([sessionId]) => sessionId);
