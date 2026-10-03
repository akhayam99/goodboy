import type { ProjectId } from '@goodboy/types';

type Params = {
  readonly task: {
    readonly externalId: string;
    readonly projectId?: ProjectId | null;
    readonly scope?: 'session' | 'branch';
    readonly branch?: string;
  };
};

export const integrationTaskKey = ({ task }: Params): string =>
  `${task.externalId}:${task.projectId ?? ''}${task.scope === 'branch' ? `:${task.branch ?? ''}` : ''}`;
