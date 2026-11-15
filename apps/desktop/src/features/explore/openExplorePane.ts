import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { openPlaceRows } from '../session/openPlaceRows';
import { PLACE_ROWS } from '../../store/slices/navigation/placeRows';

type Params = {
  readonly state: Pick<AppStore, 'setExploreMountPath'>;
  readonly sessionId: SessionId;
  readonly mountPath: string | null;
};

export const openExplorePane = ({ state, sessionId, mountPath }: Params): void => {
  if (mountPath !== null) {
    state.setExploreMountPath({ sessionId, mountPath });
  }
  openPlaceRows({
    sessionId,
    lens: 'files',
    rows: { [PLACE_ROWS.changesMode]: 'all' },
    ...(mountPath !== null && { mountPath }),
  });
};
