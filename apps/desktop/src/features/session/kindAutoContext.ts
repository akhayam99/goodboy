import type { AutoContext } from '@goodboy/core';
import type { ProviderId, ProviderPolicy } from '@goodboy/types';
import type { AutoLimitContext } from '../../store/slices/providerLimits/autoLimitContext';

type KindAutoParams = {
  readonly defaultProvider?: ProviderId | null;
  readonly limitContext?: AutoLimitContext | null;
  readonly policy?: ProviderPolicy | null;
  readonly onlyProviders?: ReadonlyArray<ProviderId> | null;
};

type NarrowParams = {
  readonly connected: ReadonlyArray<ProviderId>;
  readonly onlyProviders: ReadonlyArray<ProviderId> | null;
};

const narrowed = ({ connected, onlyProviders }: NarrowParams): ReadonlyArray<ProviderId> =>
  onlyProviders === null
    ? connected
    : connected.filter((provider) => onlyProviders.includes(provider));

export const kindAutoContext = ({
  defaultProvider,
  limitContext,
  policy,
  onlyProviders = null,
}: KindAutoParams): AutoContext | null => {
  const scopedPolicy = policy === undefined ? (limitContext?.policy ?? null) : policy;
  if (limitContext == null) {
    if (defaultProvider == null && onlyProviders === null) {
      return null;
    }
    return {
      defaultProvider: defaultProvider ?? 'anthropic',
      ...(onlyProviders !== null && { connected: onlyProviders }),
      ...(scopedPolicy !== null && { policy: scopedPolicy }),
    };
  }
  const isLimited = limitContext.atLimit.length > 0;
  const needsConnection = isLimited || scopedPolicy !== null || onlyProviders !== null;
  return {
    defaultProvider: defaultProvider ?? 'anthropic',
    ...(needsConnection && {
      connected: narrowed({ connected: limitContext.connected, onlyProviders }),
    }),
    ...(isLimited && { atLimit: limitContext.atLimit }),
    ...(scopedPolicy !== null && { policy: scopedPolicy }),
    ...(limitContext.hidden != null && { hidden: limitContext.hidden }),
    ...(limitContext.cliVersions != null && { cliVersions: limitContext.cliVersions }),
  };
};
