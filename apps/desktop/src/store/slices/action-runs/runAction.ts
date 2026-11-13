import { formatError } from '@goodboy/ui';
import type { SliceDeps } from '../../slice-types';
import type { ActionRunResult, RunActionParams, RunActionStatus } from './types';

const resultOf = async ({ task }: Pick<RunActionParams, 'task'>): Promise<ActionRunResult> => {
  try {
    const message = await task();
    return message === null ? { kind: 'silent' } : { kind: 'done', message };
  } catch (error) {
    return { kind: 'failed', message: formatError(error), error };
  }
};

export const runAction = ({ get }: Pick<SliceDeps, 'get'>) => {
  return async ({ key, actionId, choice, task }: RunActionParams): Promise<RunActionStatus> => {
    const token = get().claimActionRun({ key, actionId, choice });
    if (token === null) {
      return 'busy';
    }
    const result = await resultOf({ task });
    return get().finishActionRun({ key, token, result }) ? 'applied' : 'stale';
  };
};
