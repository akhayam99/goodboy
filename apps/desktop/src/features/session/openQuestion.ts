import type { OpenQuestionId, SessionId } from '@goodboy/types';
import { questionPlace } from '../../store/slices/navigation/place';
import type { AppStore } from '../../store/store';

type Params = {
  readonly state: Pick<AppStore, 'drawer' | 'navigate'>;
  readonly sessionId: SessionId;
  readonly questionId: OpenQuestionId;
};

export const openQuestion = ({ state, sessionId, questionId }: Params): void => {
  const drawer = state.drawer ?? null;
  const isSwitching = drawer?.kind === 'question' && drawer.sessionId === sessionId;
  state.navigate({
    to: questionPlace({ sessionId, questionId }),
    mode: isSwitching ? 'replace' : 'push',
  });
};
