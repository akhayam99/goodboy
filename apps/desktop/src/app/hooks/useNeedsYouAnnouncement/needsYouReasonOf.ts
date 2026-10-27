import type { Session } from '@goodboy/types';
import { stageInfoOf, type StageInfoState } from '../../../store/slices/session-view/stageInfoOf';
import { attentionWordsOf } from '../../../features/session/session-stage';

type Params = {
  readonly state: StageInfoState;
  readonly session: Session;
};

export const needsYouReasonOf = ({ state, session }: Params): string => {
  const info = stageInfoOf(state, session);
  return info.attention === null
    ? info.reason
    : attentionWordsOf({ reason: info.attention, counts: info });
};
