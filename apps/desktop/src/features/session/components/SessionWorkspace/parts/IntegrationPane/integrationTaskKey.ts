import type { ProjectId } from '@goodboy/types';

type Params = {
  readonly task: {
    readonly externalId: string;
    readonly projectId?: ProjectId | null;
  };
};

export const integrationTaskKey = ({ task }: Params): string =>
  `${task.externalId}:${task.projectId ?? ''}`;
