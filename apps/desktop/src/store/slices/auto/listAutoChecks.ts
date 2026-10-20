import { scriptPinId } from '../../../features/scripts/scriptPinId';
import type { AppStore } from '../../store';
import type { AutoCheckScript, ListChecksParams } from './ports';
import { resolveCheckScripts } from './resolveCheckScripts';

type Params = {
  readonly getState: () => AppStore;
  readonly params: ListChecksParams;
};

export const listAutoChecks = async ({
  getState,
  params,
}: Params): Promise<ReadonlyArray<AutoCheckScript>> => {
  const resolved = await resolveCheckScripts({ getState, ...params });
  if (resolved === null) {
    return [];
  }
  return resolved.scripts.map((script) => ({ id: scriptPinId(script), name: script.name }));
};
