import type { HiddenModels } from '@goodboy/core/providers';
import type { ProviderDisplayInfo } from '../../../features/providers/providers';
import { accountIdOf } from '../../slices/providers/accountIdOf';
import type { UnavailableModel } from '../../slices/providers/unavailableModelsSetting';

type Params = {
  readonly hidden: HiddenModels;
  readonly unavailable: ReadonlyArray<UnavailableModel>;
  readonly providers: ReadonlyArray<ProviderDisplayInfo>;
};

export const withUnavailableModels = ({ hidden, unavailable, providers }: Params): HiddenModels =>
  unavailable.reduce<HiddenModels>((merged, entry) => {
    if (entry.accountId !== accountIdOf({ providers, providerId: entry.providerId })) {
      return merged;
    }
    const current = merged[entry.providerId] ?? [];
    if (current.includes(entry.modelKey)) {
      return merged;
    }
    return { ...merged, [entry.providerId]: [...current, entry.modelKey] };
  }, hidden);
