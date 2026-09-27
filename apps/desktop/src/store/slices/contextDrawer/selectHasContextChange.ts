import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { decisionChangesSince, hasDecisionChanges } from './decisionChangesSince';

type Params = {
  readonly state: Pick<AppState, 'sessionDecisions' | 'sessionContextSeenAt'>;
  readonly sessionId: SessionId;
};

export const selectHasContextChange = ({ state, sessionId }: Params): boolean =>
  hasDecisionChanges(
    decisionChangesSince({
      ledger: state.sessionDecisions[sessionId],
      since: state.sessionContextSeenAt[sessionId],
    }),
  );
