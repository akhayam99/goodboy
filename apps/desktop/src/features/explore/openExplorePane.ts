import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';

type Params = {
  readonly state: Pick<AppStore, 'setExploreMountPath' | 'openDrawer'>;
  readonly sessionId: SessionId;
  readonly mountPath: string | null;
};

export const openExplorePane = ({ state, sessionId, mountPath }: Params): void => {
  if (mountPath !== null) {
    state.setExploreMountPath({ sessionId, mountPath });
  }
  state.openDrawer({ kind: 'explore', sessionId, payload: null });
};
