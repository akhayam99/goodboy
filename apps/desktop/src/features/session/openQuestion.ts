import type { OpenQuestionId, SessionId } from '@goodboy/types';
import { questionPlace } from '../../store/slices/navigation/place';
import type { AppStore } from '../../store/store';

type Params = {
  readonly state: Pick<AppStore, 'navigate'>;
  readonly sessionId: SessionId;
  readonly questionId: OpenQuestionId;
};

export const openQuestion = ({ state, sessionId, questionId }: Params): void => {
  state.navigate({ to: questionPlace({ sessionId, questionId }) });
};
