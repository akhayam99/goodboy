import type { ProviderId } from '@goodboy/types';
import { planLabelOf } from '../../../features/providers/planLabelOf';
import type { AppStore } from '../../store';

type Params = {
  readonly state: Partial<Pick<AppStore, 'authResults' | 'providerLimits'>>;
  readonly providerId: ProviderId;
};

export const accountPlanOf = ({ state, providerId }: Params): string | null =>
  planLabelOf({
    authPlan: state.authResults?.[providerId]?.plan,
    limitsPlan: state.providerLimits?.[providerId]?.plan,
  });
