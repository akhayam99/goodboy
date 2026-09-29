import type { EffortLevel, ProviderId } from '@goodboy/types';
import { clampEffort } from './clampEffort';
import { getModelDescriptor } from './model-display';

type LevelsParams = {
  readonly model: string;
  readonly provider?: ProviderId | null;
};

export const modelEffortLevels = ({
  model,
  provider = null,
}: LevelsParams): ReadonlyArray<EffortLevel> | null => {
  const levels = getModelDescriptor({ id: model, provider })?.effort;
  if (levels == null || levels.length === 0) {
    return null;
  }
  return levels;
};

type ClampParams = {
  readonly model: string;
  readonly effort: EffortLevel;
  readonly provider?: ProviderId | null;
};

export const clampEffortForModel = ({
  model,
  effort,
  provider = null,
}: ClampParams): EffortLevel | null => {
  const available = modelEffortLevels({ model, provider });
  if (available === null) {
    return null;
  }
  return clampEffort({ requested: effort, available });
};
