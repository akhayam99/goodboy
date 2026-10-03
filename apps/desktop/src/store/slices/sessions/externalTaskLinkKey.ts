import type { SessionExternalTask } from '@goodboy/types';

type Params = {
  readonly task: Pick<
    SessionExternalTask,
    'provider' | 'externalId' | 'projectId' | 'scope' | 'branch'
  >;
};

export const externalTaskLinkKey = ({ task }: Params): string =>
  [
    task.provider,
    task.externalId,
    task.projectId ?? '',
    task.scope === 'branch' ? (task.branch ?? '') : '',
  ].join(':');
