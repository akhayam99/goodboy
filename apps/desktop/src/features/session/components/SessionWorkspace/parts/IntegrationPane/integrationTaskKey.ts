import type { SessionExternalTask } from '@goodboy/types';

type Params = {
  readonly task: SessionExternalTask;
};

export const integrationTaskKey = ({ task }: Params): string =>
  `${task.externalId}:${task.mountWorkspaceId ?? ''}`;
