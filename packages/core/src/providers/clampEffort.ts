import type { EffortLevel } from '@goodboy/types';

const EFFORT_ORDER = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] satisfies ReadonlyArray<EffortLevel>;

type Params = {
  readonly requested: EffortLevel;
  readonly available: ReadonlyArray<EffortLevel>;
};

export const clampEffort = ({ requested, available }: Params): EffortLevel => {
  if (available.includes(requested)) {
    return requested;
  }
  const requestedIndex = EFFORT_ORDER.indexOf(requested);
  for (let index = requestedIndex - 1; index >= 0; index -= 1) {
    const candidate = EFFORT_ORDER[index];
    if (candidate != null && available.includes(candidate)) {
      return candidate;
    }
  }
  for (let index = requestedIndex + 1; index < EFFORT_ORDER.length; index += 1) {
    const candidate = EFFORT_ORDER[index];
    if (candidate != null && available.includes(candidate)) {
      return candidate;
    }
  }
  throw new Error('model has no available effort');
};
