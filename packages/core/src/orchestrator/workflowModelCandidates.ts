import { PROVIDER_IDS } from '@goodboy/types';
import { MODEL_CATALOGS } from '../providers/catalogs';
import { getProviderModelPrice } from '../providers/model-price';
import { workflowModelProfile } from '../providers/workflowModelProfiles';
import type { WorkflowModelCandidate } from './recommendWorkflowModel';
import { defaultModelEffort } from './workflowModelEfforts';
import type { WorkflowRoutingAvailabilitySnapshot } from './workflowRoutingAvailability';
import { workflowRoutingAvailability } from './workflowRoutingAvailability';

type Params = {
  readonly availability: WorkflowRoutingAvailabilitySnapshot;
};

export const workflowModelCandidates = ({
  availability,
}: Params): ReadonlyArray<WorkflowModelCandidate> => {
  const candidates: Array<WorkflowModelCandidate> = [];
  for (const provider of PROVIDER_IDS) {
    for (const model of MODEL_CATALOGS[provider]) {
      const effort = defaultModelEffort({ provider, model: model.key });
      const status = workflowRoutingAvailability({
        pick: { provider, model: model.key, effort },
        snapshot: availability,
      });
      if (status.kind !== 'available') {
        continue;
      }
      candidates.push({
        provider,
        model: model.key,
        effort,
        contextWindow: model.contextWindow,
        profile: workflowModelProfile({ provider, model: model.key }),
        price: getProviderModelPrice({ provider, model: model.key }),
      });
    }
  }
  return candidates;
};
