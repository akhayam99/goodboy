import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  isAutoLevelLeft,
  isSessionLevelLeft,
  type SidebarLevel,
} from '../../../../store/slices/navigation/sidebarLevel';
import type { ColumnPlace } from '../columnPlace';
import { useIsOnAutoAgent } from '../useIsOnAutoAgent';

type Params = {
  readonly place: ColumnPlace;
  readonly currentSessionId: SessionId | null;
};

export const useSidebarLevel = ({ place, currentSessionId }: Params): SidebarLevel => {
  const isLeft = useAppStore((state) => isSessionLevelLeft({ state }));
  const isAutoLeft = useAppStore((state) => isAutoLevelLeft({ state }));
  const isOnAutoAgent = useIsOnAutoAgent({ currentSessionId });
  if (place !== null || currentSessionId === null || isLeft) {
    return 'workspace';
  }
  if (isOnAutoAgent && !isAutoLeft) {
    return 'auto';
  }
  return 'session';
};
