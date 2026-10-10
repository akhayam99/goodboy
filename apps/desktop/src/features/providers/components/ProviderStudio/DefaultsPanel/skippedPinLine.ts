import type { ProviderStanding } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../providerLabel';
import { modelNameOf } from './modelNameOf';

type Route = {
  readonly provider: ProviderId;
  readonly model: string;
};

type Params = {
  readonly pinned: Route;
  readonly using: Route;
  readonly standing: ProviderStanding;
};

type ReasonParams = {
  readonly provider: ProviderId;
  readonly standing: ProviderStanding;
};

const reasonOf = ({ provider, standing }: ReasonParams): string => {
  const label = PROVIDER_LABEL[provider];
  if (standing === 'off') {
    return `${label} is Off`;
  }
  if (standing === 'not-connected') {
    return `${label} is not connected`;
  }
  return `${label} cannot run`;
};

export const skippedPinLine = ({ pinned, using, standing }: Params): string =>
  `Pinned ${modelNameOf(pinned)} is skipped: ${reasonOf({ provider: pinned.provider, standing })}. Using ${modelNameOf(using)}.`;
