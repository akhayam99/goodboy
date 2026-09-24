import { useCallback, useState } from 'react';
import {
  ACTIVITY_FILTER_PRESETS,
  activityFilterPresetOf,
  hiddenActivityToggles,
  readActivityFilter,
  writeActivityFilter,
  type ActivityFilter,
  type ActivityPreset,
  type ActivityToggle,
} from '../../timeline/activityFilter';

export type ActivityFilterControl = {
  readonly filter: ActivityFilter;
  readonly hidden: ReadonlyArray<ActivityToggle>;
  readonly preset: ActivityPreset | null;
  readonly isNeedsYou: boolean;
  readonly setToggle: (params: {
    readonly toggle: ActivityToggle;
    readonly enabled: boolean;
  }) => void;
  readonly applyPreset: (params: { readonly preset: ActivityPreset }) => void;
};

export const useActivityFilter = (): ActivityFilterControl => {
  const [filter, setFilter] = useState<ActivityFilter>(() => readActivityFilter());
  const [isNeedsYou, setIsNeedsYou] = useState(false);

  const commit = useCallback(({ next }: { readonly next: ActivityFilter }) => {
    writeActivityFilter({ filter: next });
    setFilter(next);
  }, []);

  const setToggle = useCallback(
    ({ toggle, enabled }: { readonly toggle: ActivityToggle; readonly enabled: boolean }) => {
      setIsNeedsYou(false);
      setFilter((current) => {
        const next: ActivityFilter = { ...current, [toggle]: enabled };
        writeActivityFilter({ filter: next });
        return next;
      });
    },
    [],
  );

  const applyPreset = useCallback(
    ({ preset }: { readonly preset: ActivityPreset }) => {
      if (preset === 'needsYou') {
        setIsNeedsYou(true);
        return;
      }
      setIsNeedsYou(false);
      commit({ next: ACTIVITY_FILTER_PRESETS[preset] });
    },
    [commit],
  );

  return {
    filter,
    hidden: hiddenActivityToggles({ filter }),
    preset: isNeedsYou ? 'needsYou' : activityFilterPresetOf({ filter }),
    isNeedsYou,
    setToggle,
    applyPreset,
  };
};
