import type { SessionId, SessionProjectMount } from '@goodboy/types';
import type { AppState } from '../../types';
import { selectWritableMounts } from './selectors';

type Params = {
  readonly state: Pick<AppState, 'sessionMounts' | 'sessionProjectMounts'>;
  readonly sessionId: SessionId;
};

export const selectAutomaticTurnMount = ({
  state,
  sessionId,
}: Params): SessionProjectMount | null =>
  selectWritableMounts({ state, sessionId }).reduce<SessionProjectMount | null>(
    (selected, candidate) => {
      if (selected === null) {
        return candidate;
      }
      if (candidate.parallelIndex < selected.parallelIndex) {
        return candidate;
      }
      if (
        candidate.parallelIndex === selected.parallelIndex &&
        candidate.mountId < selected.mountId
      ) {
        return candidate;
      }
      return selected;
    },
    null,
  );
