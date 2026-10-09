import type { EffortLevel, ProviderId } from '@goodboy/types';

export type PickedRoute = {
  readonly provider: ProviderId | '';
  readonly model: string;
  readonly effort: EffortLevel;
};
