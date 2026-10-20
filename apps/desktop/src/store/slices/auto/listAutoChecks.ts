import { scriptPinId } from '../../../features/scripts/scriptPinId';
import type { AppStore } from '../../store';
import { missingCheckName } from './missingCheckName';
import type { AutoCheckList, ListChecksParams } from './ports';
import { resolveCheckScripts } from './resolveCheckScripts';

type Params = {
  readonly getState: () => AppStore;
  readonly params: ListChecksParams;
};

export const listAutoChecks = async ({ getState, params }: Params): Promise<AutoCheckList> => {
  const resolved = await resolveCheckScripts({ getState, ...params });
  if (resolved === null) {
    return { scripts: [], missing: [] };
  }
  const found = new Set(resolved.scripts.map((script) => scriptPinId(script)));
  const saved = Object.values(getState().projectScripts).flat();
  return {
    scripts: resolved.scripts.map((script) => ({ id: scriptPinId(script), name: script.name })),
    missing: resolved.ticked
      .filter((pinId) => !found.has(pinId))
      .map((pinId) => missingCheckName({ pinId, saved })),
  };
};
