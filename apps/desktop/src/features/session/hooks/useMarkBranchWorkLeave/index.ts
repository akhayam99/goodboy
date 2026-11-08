import { useEffect, useRef } from 'react';
import { useAppStore } from '../../../../store';
import { stackKey } from '../../../../store/slices/navigation/currentStack';
import { runGroupFocusOf } from '../../../../store/slices/navigation/runGroupFocusOf';
import type { Place } from '../../../../store/slices/navigation/types';
import { withTopFocus } from '../../../../store/slices/navigation/withTopFocus';

type Params = {
  readonly groupKey: string | null;
  readonly mountPath: string | null;
};

type PlaceParams = {
  readonly place: Place;
};

const isWorkItemPlace = ({ place }: PlaceParams): boolean =>
  place.at === 'session' &&
  (place.view.agentId !== null ||
    place.view.target?.kind === 'run' ||
    place.view.target?.kind === 'artifact');

export const useMarkBranchWorkLeave = ({ groupKey, mountPath }: Params): void => {
  const leaveRef = useRef({ groupKey, mountPath });
  leaveRef.current = { groupKey, mountPath };

  useEffect(
    () =>
      useAppStore.subscribe((state, previous) => {
        if (state.navigation === previous.navigation) {
          return;
        }
        const { groupKey: key, mountPath: path } = leaveRef.current;
        const stack = state.navigation[stackKey(state)];
        const place = stack?.entries[stack.index]?.place;
        if (key === null || place === undefined || !isWorkItemPlace({ place })) {
          return;
        }
        if (runGroupFocusOf({ state }) !== null) {
          return;
        }
        useAppStore.setState((current) => ({
          navigation: withTopFocus({
            state: current,
            patch: { runGroup: { groupKey: key, mountPath: path } },
          }),
        }));
      }),
    [],
  );
};
