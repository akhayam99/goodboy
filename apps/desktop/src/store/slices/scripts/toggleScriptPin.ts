import type { ProjectId } from '@goodboy/types';
import { parseScriptPins } from '../../../features/scripts/parseScriptPins';
import { scriptPinsKey } from '../../../features/scripts/scriptPinsKey';
import type { GetFn } from './types';

type Params = {
  readonly projectId: ProjectId;
  readonly pinId: string;
};

export const toggleScriptPin = (get: GetFn) => {
  return async ({ projectId, pinId }: Params): Promise<void> => {
    const key = scriptPinsKey({ projectId });
    const pins = parseScriptPins({ raw: get().settings[key] });
    const next = pins.includes(pinId) ? pins.filter((pin) => pin !== pinId) : [...pins, pinId];
    await get().saveSetting(key, JSON.stringify(next));
  };
};
