import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  isSessionLevelLeft,
  type SidebarLevel,
} from '../../../../store/slices/navigation/sidebarLevel';
import type { ColumnPlace } from '../columnPlace';

type Params = {
  readonly place: ColumnPlace;
  readonly currentSessionId: SessionId | null;
};

export const useSidebarLevel = ({ place, currentSessionId }: Params): SidebarLevel => {
  const isLeft = useAppStore((state) => isSessionLevelLeft({ state }));
  if (place !== null || currentSessionId === null || isLeft) {
    return 'workspace';
  }
  return 'session';
};
