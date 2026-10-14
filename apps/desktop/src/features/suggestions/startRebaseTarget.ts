import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { dispatchAfterNavigation } from '../actions/dispatchAfterNavigation';
import { HISTORY_FOCUS_BASE_EVENT, diffEventName } from '../actions/kinds/diff';
import type { RebaseSuggestionTarget } from './types';

type Params = {
  readonly openRewriteHistory: AppStore['openRewriteHistory'];
  readonly sessionId: SessionId;
  readonly target: RebaseSuggestionTarget;
};

export const startRebaseTarget = ({ openRewriteHistory, sessionId, target }: Params): void => {
  openRewriteHistory(sessionId, target.worktreePath);
  dispatchAfterNavigation({ name: diffEventName({ name: HISTORY_FOCUS_BASE_EVENT, sessionId }) });
};
