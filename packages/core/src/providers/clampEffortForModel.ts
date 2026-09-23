import type { EffortLevel } from '@goodboy/types';
import { clampEffort } from './clampEffort';
import { getModelDescriptor } from './model-display';

type LevelsParams = {
  readonly model: string;
};

export const modelEffortLevels = ({ model }: LevelsParams): ReadonlyArray<EffortLevel> | null => {
  const levels = getModelDescriptor(model)?.effort;
  if (levels == null || levels.length === 0) {
    return null;
  }
  return levels;
};

type ClampParams = {
  readonly model: string;
  readonly effort: EffortLevel;
};

export const clampEffortForModel = ({ model, effort }: ClampParams): EffortLevel | null => {
  const available = modelEffortLevels({ model });
  if (available === null) {
    return null;
  }
  return clampEffort({ requested: effort, available });
};
