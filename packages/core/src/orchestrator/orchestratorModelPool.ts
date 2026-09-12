import { PROVIDER_IDS } from '@goodboy/types';
import { MODEL_CATALOGS } from '../providers/catalogs';
import { getProviderModelPrice } from '../providers/model-price';
import { workflowModelProfile } from '../providers/workflowModelProfiles';
import type { OrchestratorModelOption } from './types';
import type { WorkflowRoutingAvailabilitySnapshot } from './workflowRoutingAvailability';
import { workflowRoutingAvailability } from './workflowRoutingAvailability';
import { defaultModelEffort, supportedModelEfforts } from './workflowModelEfforts';

type Params = {
  readonly availability: WorkflowRoutingAvailabilitySnapshot;
};

export const orchestratorModelPool = ({
  availability,
}: Params): ReadonlyArray<OrchestratorModelOption> => {
  const options: Array<OrchestratorModelOption> = [];
  for (const provider of PROVIDER_IDS) {
    for (const model of MODEL_CATALOGS[provider]) {
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
