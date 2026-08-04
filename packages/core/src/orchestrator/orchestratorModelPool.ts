import type { ModelCostTier, ProviderId } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from '../providers/capabilities';
import type { OrchestratorModelOption, OrchestratorRoleDefault } from './types';

const MODEL_NOTE: Readonly<Record<ModelCostTier, string>> = {
  cheap: 'cheap, fast',
  mid: 'balanced default',
  expensive: 'deepest reasoning',
};

type Params = {
  readonly provider: ProviderId;
  readonly roleDefaults: ReadonlyArray<OrchestratorRoleDefault>;
};

export const orchestratorModelPool = ({
  provider,
  roleDefaults,
}: Params): ReadonlyArray<OrchestratorModelOption> => {
  const catalog = PROVIDER_CAPABILITIES[provider].models;
  const rankById = new Map(catalog.map((model, index) => [model.id, index]));
  return [...new Set(roleDefaults.map((entry) => entry.model))]
    .sort(
      (left, right) =>
        (rankById.get(left) ?? catalog.length) - (rankById.get(right) ?? catalog.length),
    )
    .map((id) => {
      const descriptor = catalog.find((model) => model.id === id);
      return {
        id,
        label: descriptor?.label ?? id,
        note: MODEL_NOTE[descriptor?.costTier ?? 'mid'],
      };
    });
};
