import type { HiddenModels } from '@goodboy/core/providers';
import type { UnavailableModelKey } from '../../slices/providers/unavailableModelsSetting';

type Params = {
  readonly hidden: HiddenModels;
  readonly unavailable: ReadonlyArray<UnavailableModelKey>;
};

export const withUnavailableModels = ({ hidden, unavailable }: Params): HiddenModels =>
  unavailable.reduce<HiddenModels>((merged, entry) => {
    const current = merged[entry.providerId] ?? [];
    if (current.includes(entry.modelKey)) {
      return merged;
    }
    return { ...merged, [entry.providerId]: [...current, entry.modelKey] };
  }, hidden);
