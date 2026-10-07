import { PROVIDER_IDS } from '@goodboy/types';
import { getProviderModelPrice } from '../providers/model-price';
import { selectableModels, type HiddenModels } from '../providers/modelVisibility';
import { MODEL_CATALOGS } from '../providers/catalogs';
import { workflowModelProfile } from '../providers/workflowModelProfiles';
import type { OrchestratorModelOption } from './types';
import type { WorkflowRoutingAvailabilitySnapshot } from './workflowRoutingAvailability';
import { workflowRoutingAvailability } from './workflowRoutingAvailability';
import { defaultModelEffort, supportedModelEfforts } from './workflowModelEfforts';

type Params = {
  readonly availability: WorkflowRoutingAvailabilitySnapshot;
  readonly hidden: HiddenModels | null;
};

export const orchestratorModelPool = ({
  availability,
  hidden,
}: Params): ReadonlyArray<OrchestratorModelOption> => {
  const options: Array<OrchestratorModelOption> = [];
  for (const provider of availability.providerOrder ?? PROVIDER_IDS) {
    const models =
      hidden == null ? MODEL_CATALOGS[provider] : selectableModels({ provider, hidden });
    for (const model of models) {
      const status = workflowRoutingAvailability({
        pick: {
          provider,
          model: model.key,
          effort: defaultModelEffort({ provider, model: model.key }),
        },
        snapshot: availability,
      });
      if (status.kind !== 'available') {
        continue;
      }
      const profile = workflowModelProfile({ provider, model: model.key });
      options.push({
        provider,
        model: model.key,
        label: model.label,
        efforts: supportedModelEfforts({ provider, model: model.key }),
        taskTypes: profile === null ? [] : profile.taskTypes,
        preferredDifficulty: profile === null ? [] : profile.preferredDifficulty,
        contextWindow: model.contextWindow,
        price: getProviderModelPrice({ provider, model: model.key }),
      });
    }
  }
  return options;
};
