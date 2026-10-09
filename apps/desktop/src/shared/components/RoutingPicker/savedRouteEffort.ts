import { clampEffortForModel } from '@goodboy/core';
import type { EffortLevel } from '@goodboy/types';
import type { PickedRoute } from './PickedRoute';

type Params = {
  readonly route: PickedRoute;
  readonly requested: EffortLevel;
  readonly wasSaved: boolean;
};

export const savedRouteEffort = ({ route, requested, wasSaved }: Params): EffortLevel | null => {
  if (route.provider === '') {
    return null;
  }
  const served = clampEffortForModel({
    model: route.model,
    effort: route.effort,
    provider: route.provider,
  });
  if (served === null) {
    return null;
  }
  return wasSaved || served !== requested ? served : null;
};
