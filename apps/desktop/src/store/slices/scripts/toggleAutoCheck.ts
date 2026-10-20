import type { ProjectId } from '@goodboy/types';
import { autoChecksKey } from '../../../features/scripts/autoChecksKey';
import { parseScriptPins } from '../../../features/scripts/parseScriptPins';
import { createKeyedQueue } from '../../../shared/utils/keyedQueue';
import type { GetFn } from './types';

type Params = {
  readonly projectId: ProjectId;
  readonly pinId: string;
};

const queue = createKeyedQueue();

export const toggleAutoCheck = (get: GetFn) => {
  return async ({ projectId, pinId }: Params): Promise<void> => {
    const key = autoChecksKey({ projectId });
    await queue.run({
      key,
      task: async () => {
        const ticked = parseScriptPins({ raw: get().settings[key] });
        const next = ticked.includes(pinId)
          ? ticked.filter((entry) => entry !== pinId)
          : [...ticked, pinId];
        await get().saveSetting(key, JSON.stringify(next));
      },
    });
  };
};
