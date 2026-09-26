import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';

type Params = {
  readonly providerId: ProviderId;
};

const capitalized = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') {
    return null;
  }
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

export const usePlanLabel = ({ providerId }: Params): string | null => {
  const fromAuth = useAppStore((state) => state.authResults?.[providerId]?.plan ?? null);
  const fromLimits = useAppStore((state) => state.providerLimits[providerId]?.plan ?? null);
  return capitalized(fromAuth) ?? capitalized(fromLimits);
};
