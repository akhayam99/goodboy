import type { SessionExternalTask } from '@goodboy/types';

type Params = {
  readonly task: Pick<SessionExternalTask, 'provider' | 'externalId' | 'projectId'>;
};

export const taskIdentityKey = ({ task }: Params): string =>
  [task.provider, task.externalId, task.projectId ?? ''].join(':');
