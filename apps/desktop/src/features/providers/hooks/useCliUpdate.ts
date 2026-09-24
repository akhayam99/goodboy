import { useCallback } from 'react';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useIsProviderTurnRunning } from './useIsProviderTurnRunning';

type Params = {
  readonly providerId: ProviderId;
};

export type CliUpdate = {
  readonly runId: string | null;
  readonly isUpdating: boolean;
  readonly hasFailed: boolean;
  readonly hasFinished: boolean;
  readonly errorTail: string | null;
  readonly isBlockedByTurn: boolean;
  readonly start: () => void;
};

export const useCliUpdate = ({ providerId }: Params): CliUpdate => {
  const lifecycle = useAppStore((state) => state.providerLifecycle[providerId]);
  const updateProviderCli = useAppStore((state) => state.updateProviderCli);
  const isBlockedByTurn = useIsProviderTurnRunning({ providerId });
  const isUpdateRun = lifecycle.action === 'update';
  const start = useCallback(() => {
    void updateProviderCli(providerId);
  }, [providerId, updateProviderCli]);
  return {
    runId: isUpdateRun ? lifecycle.runId : null,
    isUpdating: isUpdateRun && lifecycle.phase === 'updating',
    hasFailed: isUpdateRun && lifecycle.phase === 'error',
    hasFinished: isUpdateRun && lifecycle.phase === 'installed',
    errorTail: isUpdateRun ? lifecycle.errorTail : null,
    isBlockedByTurn,
    start,
  };
};
