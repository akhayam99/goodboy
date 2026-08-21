import { useCallback, useState } from 'react';
import {
  readActivityFilter,
  writeActivityFilter,
  type ActivityCategory,
  type ActivityFilter,
} from '../../timeline/activityFilter';

export type ActivityFilterControl = {
  readonly filter: ActivityFilter;
  readonly hiddenCount: number;
  readonly setCategory: (params: {
    readonly category: ActivityCategory;
    readonly enabled: boolean;
  }) => void;
};

export const useActivityFilter = (): ActivityFilterControl => {
  const [filter, setFilter] = useState<ActivityFilter>(() => readActivityFilter());

  const setCategory = useCallback(
    ({ category, enabled }: { readonly category: ActivityCategory; readonly enabled: boolean }) => {
      setFilter((current) => {
        const next: ActivityFilter = { ...current, [category]: enabled };
        writeActivityFilter({ filter: next });
        return next;
      });
    },
    [],
  );

  return {
    filter,
    hiddenCount: Object.values(filter).filter((enabled) => !enabled).length,
    setCategory,
  };
};
