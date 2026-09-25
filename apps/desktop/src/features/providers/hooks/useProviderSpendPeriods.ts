import { useEffect, useState } from 'react';
import { summarizeProviderSpendPeriods, type ProviderSpendPeriods } from '@goodboy/db';
import type { ProviderId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { useAppStore } from '../../../store';

const DAYS_IN_WEEK_WINDOW = 7;

type StartsParams = {
  readonly nowMs: number;
};

type PeriodStarts = {
  readonly todayStartMs: number;
  readonly weekStartMs: number;
  readonly monthStartMs: number;
};

export const periodStarts = ({ nowMs }: StartsParams): PeriodStarts => {
  const now = new Date(nowMs);
  return {
    todayStartMs: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
    weekStartMs: new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (DAYS_IN_WEEK_WINDOW - 1),
    ).getTime(),
    monthStartMs: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
  };
};

type Params = {
  readonly providerId: ProviderId;
};

export const useProviderSpendPeriods = ({ providerId }: Params): ProviderSpendPeriods | null => {
  const workspaceId = useAppStore((state) => state.currentWorkspaceId);
  const [periods, setPeriods] = useState<ProviderSpendPeriods | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setPeriods(null);
    summarizeProviderSpendPeriods({
      db: tauriDatabase,
      provider: providerId,
      workspaceId,
      ...periodStarts({ nowMs: Date.now() }),
    })
      .then((next) => {
        if (isCurrent) {
          setPeriods(next);
        }
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [providerId, workspaceId]);

  return periods;
};
