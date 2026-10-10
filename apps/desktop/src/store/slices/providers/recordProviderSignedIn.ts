import type { ProviderId } from '@goodboy/types';
import { applyProviderHealthAction } from './applyProviderHealthAction';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly providerId: ProviderId;
};

export const recordProviderSignedIn = ({ set, get, providerId }: Params): void => {
  applyProviderHealthAction({
    set,
    get,
    providerId,
    action: { type: 'signed_in', at: Date.now() },
  });
};
