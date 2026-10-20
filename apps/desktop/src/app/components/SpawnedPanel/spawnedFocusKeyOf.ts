import type { SpawnedFocus } from './spawnedFocus';

type Params = {
  readonly focus: SpawnedFocus | null;
};

export const spawnedFocusKeyOf = ({ focus }: Params): string | null => {
  if (focus === null) {
    return null;
  }
  return focus.kind === 'run' ? `run:${focus.runId}` : `auto:${focus.rootAgentId}`;
};
