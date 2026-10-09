import type { MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { selectActiveMount } from '../project-mounts/selectors';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly mountId?: MountId | undefined;
};

export const entryMountIdOf = ({ state, sessionId, mountId }: Params): MountId | null =>
  mountId ?? selectActiveMount({ state, sessionId })?.mountId ?? null;
