import type { Session } from '@goodboy/types';
import { stageInfoOf, type StageInfoState } from '../../../store/slices/session-view/stageInfoOf';
import { attentionWordsOf } from '../../../features/session/session-stage';

type Params = {
  readonly state: StageInfoState;
  readonly sessions: ReadonlyArray<Session>;
};

export const needsYouReasonsOf = ({ state, sessions }: Params): ReadonlyArray<string> => {
  const words = sessions.map((session) => {
    const info = stageInfoOf(state, session);
    return info.attention === null
      ? info.reason
      : attentionWordsOf({ reason: info.attention, counts: info });
  });
  return [...new Set(words.filter((word) => word.trim() !== ''))];
};
