import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { planLabelOf } from '../../../planLabelOf';

type Params = {
  readonly providerId: ProviderId;
};

export const usePlanLabel = ({ providerId }: Params): string | null => {
  const authPlan = useAppStore((state) => state.authResults?.[providerId]?.plan ?? null);
  const limitsPlan = useAppStore((state) => state.providerLimits[providerId]?.plan ?? null);
  return planLabelOf({ authPlan, limitsPlan });
};
