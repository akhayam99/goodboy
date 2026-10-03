import type { AutoContext } from '@goodboy/core';
import type { ProviderId, ProviderPolicy } from '@goodboy/types';
import type { AutoLimitContext } from '../../store/slices/providerLimits/autoLimitContext';

type KindAutoParams = {
  readonly defaultProvider?: ProviderId | null;
  readonly limitContext?: AutoLimitContext | null;
  readonly policy?: ProviderPolicy | null;
};

export const kindAutoContext = ({
  defaultProvider,
  limitContext,
  policy,
}: KindAutoParams): AutoContext | null => {
  const scopedPolicy = policy === undefined ? (limitContext?.policy ?? null) : policy;
  if (limitContext == null) {
    if (defaultProvider == null) {
      return null;
    }
    return { defaultProvider, ...(scopedPolicy !== null && { policy: scopedPolicy }) };
  }
  const isLimited = limitContext.atLimit.length > 0;
  const needsConnection = isLimited || scopedPolicy !== null;
  return {
    defaultProvider: defaultProvider ?? 'anthropic',
    ...(needsConnection && { connected: limitContext.connected }),
    ...(isLimited && { atLimit: limitContext.atLimit }),
    ...(scopedPolicy !== null && { policy: scopedPolicy }),
    ...(limitContext.hidden != null && { hidden: limitContext.hidden }),
    ...(limitContext.cliVersions != null && { cliVersions: limitContext.cliVersions }),
  };
};
