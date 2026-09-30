import { useEffect, useState } from 'react';
import type { ProviderBudgetOverview, ProviderId } from '@goodboy/types';
import { invokeProviderBudgetOverview } from '../../budget/budget';
import { useAppStore } from '../../../store';

const DAYS_IN_WEEK_WINDOW = 7;

type StartsParams = {
  readonly nowMs: number;
};

type PeriodStarts = {
  readonly todayStartMs: number;
  readonly weekStartMs: number;
};

const periodStarts = ({ nowMs }: StartsParams): PeriodStarts => {
  const now = new Date(nowMs);
  return {
    todayStartMs: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
    weekStartMs: new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (DAYS_IN_WEEK_WINDOW - 1),
    ).getTime(),
  };
};

type Params = {
  readonly providerId: ProviderId;
};

type Loaded = {
  readonly providerId: ProviderId;
  readonly overview: ProviderBudgetOverview;
};

export const useProviderBudgetOverview = ({
  providerId,
}: Params): ProviderBudgetOverview | null => {
  const rule = useAppStore((state) =>
    state.budgetRules.find((candidate) => candidate.provider === providerId),
  );
  const capUsd = rule?.capUsd ?? null;
  const thresholdPct = rule?.alertThresholdPct ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let isCurrent = true;
    invokeProviderBudgetOverview({
      provider: providerId,
      ...periodStarts({ nowMs: Date.now() }),
    })
      .then((next) => {
        if (isCurrent && next !== undefined) {
          setLoaded({ providerId, overview: next });
        }
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [providerId, capUsd, thresholdPct]);

  return loaded !== null && loaded.providerId === providerId ? loaded.overview : null;
};
