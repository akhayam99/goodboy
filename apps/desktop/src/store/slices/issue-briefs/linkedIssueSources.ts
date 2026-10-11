import type { SessionExternalTask } from '@goodboy/types';
import { taskIdentityKey } from '../../../shared/utils/taskIdentityKey';
import type { IssueBriefSource } from './types';

type Params = { readonly tasks: ReadonlyArray<SessionExternalTask> };

export const linkedIssueSources = ({ tasks }: Params): ReadonlyArray<IssueBriefSource> => {
  const seen = new Set<string>();
  return tasks.flatMap((task) => {
    if (task.provider === 'slack' || task.provider === 'bitbucket') {
      return [];
    }
    const key = taskIdentityKey({ task });
    if (seen.has(key)) {
      return [];
    }
    if (
      (task.provider === 'github' && !task.url.includes('/issues/')) ||
      (task.provider === 'gitlab' && !task.url.includes('/issues/'))
    ) {
      return [];
    }
    seen.add(key);
    return [{ ...task, body: '', noun: 'issue' }];
  });
};
