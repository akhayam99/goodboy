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

export const periodStarts = ({ nowMs }: StartsParams): PeriodStarts => {
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

export const useProviderBudgetOverview = ({
  providerId,
}: Params): ProviderBudgetOverview | null => {
  const rules = useAppStore((state) => state.budgetRules);
  const [overview, setOverview] = useState<ProviderBudgetOverview | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setOverview(null);
    invokeProviderBudgetOverview({
      provider: providerId,
      ...periodStarts({ nowMs: Date.now() }),
    })
      .then((next) => {
        if (isCurrent && next !== undefined) {
          setOverview(next);
        }
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [providerId, rules]);

  return overview;
};
