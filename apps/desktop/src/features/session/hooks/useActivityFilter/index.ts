import { useCallback, useState } from 'react';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_TOGGLES,
  readActivityFilter,
  writeActivityFilter,
  type ActivityFilter,
  type ActivityToggle,
} from '../../timeline/activityFilter';

export type ActivityFilterControl = {
  readonly filter: ActivityFilter;
  readonly hiddenCount: number;
  readonly setToggle: (params: {
    readonly toggle: ActivityToggle;
    readonly enabled: boolean;
  }) => void;
  readonly setAll: (params: { readonly enabled: boolean }) => void;
};

export const useActivityFilter = (): ActivityFilterControl => {
  const [filter, setFilter] = useState<ActivityFilter>(() => readActivityFilter());

  const setToggle = useCallback(
    ({ toggle, enabled }: { readonly toggle: ActivityToggle; readonly enabled: boolean }) => {
      setFilter((current) => {
        const next: ActivityFilter = { ...current, [toggle]: enabled };
        writeActivityFilter({ filter: next });
        return next;
      });
    },
    [],
  );

  const setAll = useCallback(({ enabled }: { readonly enabled: boolean }) => {
    setFilter((current) => {
      const next = enabled
        ? (Object.fromEntries(ACTIVITY_TOGGLES.map((toggle) => [toggle, true])) as ActivityFilter)
        : {
            ...current,
            ...(Object.fromEntries(
              ACTIVITY_CATEGORIES.map((category) => [category, false]),
            ) as Partial<ActivityFilter>),
          };
      writeActivityFilter({ filter: next });
      return next;
    });
  }, []);

  return {
    filter,
    hiddenCount: Object.values(filter).filter((enabled) => !enabled).length,
    setToggle,
    setAll,
  };
};
