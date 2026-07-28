import type {
  AuxTaskId,
  ProviderId,
  TaskModelPreference,
  TaskModelPreferences,
} from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { getCheapModel } from './cli-defaults';
import { resolveStoredModelSelection } from './resolveStoredModelSelection';

export const resolveTaskModel = (
  task: AuxTaskId,
  prefs: TaskModelPreferences | null | undefined,
  defaultProviderId: ProviderId,
): TaskModelPreference => {
  const preference = prefs?.[task];
  if (preference != null && PROVIDER_CAPABILITIES[preference.providerId] != null) {
    const stored = resolveStoredModelSelection({
      provider: preference.providerId,
      id: preference.model,
    });
    if (stored.report?.kind !== 'unknown') {
      return { providerId: preference.providerId, model: stored.selection.key };
    }
  }
  return {
    providerId: defaultProviderId,
    model: getCheapModel(defaultProviderId),
  };
};
