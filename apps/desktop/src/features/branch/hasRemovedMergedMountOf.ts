import type { SessionId } from '@goodboy/types';
import {
  isMountRequestMerged,
  sessionMountViews,
  type MountRequestState,
} from '../../store/slices/project-mounts/mountRowModel';
import type { AppState } from '../../store/types';

type Params = {
  readonly state: MountRequestState & Pick<AppState, 'sessionMounts' | 'sessionProjectMounts'>;
  readonly sessionId: SessionId;
};

export const hasRemovedMergedMountOf = ({ state, sessionId }: Params): boolean => {
  const views = sessionMountViews({ state, sessionId });
  return (
    views.every((view) => !view.isAttached) &&
    views.some((view) => isMountRequestMerged({ state, mountId: view.id }))
  );
};
