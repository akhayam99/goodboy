import type {
  AuxTaskId,
  ProviderId,
  TaskModelPreference,
  TaskModelPreferences,
} from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { getCheapModel } from './cli-defaults';

export const resolveTaskModel = (
  task: AuxTaskId,
  prefs: TaskModelPreferences | null | undefined,
  defaultProviderId: ProviderId,
): TaskModelPreference => {
  const preference = prefs?.[task];
  const isValid =
    preference != null &&
    PROVIDER_CAPABILITIES[preference.providerId]?.models.some(
      (model) => model.id === preference.model,
    );
  if (isValid) {
    return preference;
  }
  return {
    providerId: defaultProviderId,
    model: getCheapModel(defaultProviderId),
  };
};
