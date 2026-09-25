import { useMemo } from 'react';
import { outdatedCliModels, type CliGate } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../store';

type Params = {
  readonly providerId: ProviderId;
};

export const useOutdatedCliModels = ({ providerId }: Params): ReadonlyArray<CliGate> => {
  const installedVersion = useAppStore(
    (state) => state.providers.find((item) => item.id === providerId)?.version ?? null,
  );
  const learned = useAppStore((state) => state.cliRequirements);
  return useMemo(
    () => outdatedCliModels({ provider: providerId, installedVersion, learned }),
    [installedVersion, learned, providerId],
  );
};
