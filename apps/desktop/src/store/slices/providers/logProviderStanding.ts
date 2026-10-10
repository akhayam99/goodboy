import type { ProviderId } from '@goodboy/types';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type { HealthEvent } from './providerHealth';

type Params = {
  readonly providerId: ProviderId;
  readonly event: HealthEvent;
};

export const logProviderStanding = ({ providerId, event }: Params): void => {
  void invokeCommand('log_provider_standing', {
    provider: providerId,
    from: event.from,
    to: event.to,
    reason: event.reason,
  }).catch(() => undefined);
};
