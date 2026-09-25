import { useMemo } from 'react';
import { catalogModelForId, cliGate, type CliGate } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../store';

type Params = {
  readonly provider: ProviderId | '';
  readonly modelId: string;
};

export const useCliGate = ({ provider, modelId }: Params): CliGate | null => {
  const installedVersion = useAppStore((state) =>
    provider === ''
      ? null
      : (state.providers.find((item) => item.id === provider)?.version ?? null),
  );
  const learned = useAppStore((state) => state.cliRequirements);
  return useMemo(() => {
    if (provider === '') {
      return null;
    }
    const model = catalogModelForId({ provider, modelId });
    if (model === null) {
      return null;
    }
    return cliGate({ provider, modelKey: model.key, installedVersion, learned });
  }, [installedVersion, learned, modelId, provider]);
};
