import type {
  AuxTaskId,
  ProviderId,
  TaskModelPreference,
  TaskModelPreferences,
} from '@goodboy/types';
import { PROVIDER_CAPABILITIES, getDefaultTurnModel } from './capabilities';
import { getCheapModel, getMidModel } from './cli-defaults';
import { resolveStoredModelSelection } from './resolveStoredModelSelection';

const automaticModelForTask = (task: AuxTaskId, providerId: ProviderId): string => {
  if (task === 'rebase') {
    return providerId === 'anthropic' ? 'sonnet-5' : getDefaultTurnModel({ id: providerId });
  }
  if (task === 'workflow_orchestrator') {
    return getMidModel(providerId);
  }
  return getCheapModel(providerId);
};

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
      return {
        providerId: preference.providerId,
        model: stored.selection.key,
        ...(preference.effort != null && { effort: preference.effort }),
      };
    }
  }
  return {
    providerId: defaultProviderId,
    model: automaticModelForTask(task, defaultProviderId),
  };
};
