import type { SessionAttentionReason } from '@goodboy/types';
import { sessionPlace } from '../../../store';
import type { AppStore } from '../../../store/store';
import type { PlaceRequest } from '../../../store/slices/navigation/types';
import { attentionPlace } from '../../session/attentionPlace';
import type { QueueMove } from './needsYouOf';

const OPENS_THE_OVERVIEW: ReadonlySet<SessionAttentionReason> = new Set<SessionAttentionReason>([
  'open-question',
  'needs-approval',
  'plan-approval',
]);

type Params = {
  readonly state: AppStore;
  readonly move: QueueMove;
};

export const queueLandingOf = ({ state, move }: Params): PlaceRequest =>
  OPENS_THE_OVERVIEW.has(move.reason)
    ? sessionPlace({ sessionId: move.sessionId })
    : attentionPlace({ state, sessionId: move.sessionId, reason: move.reason });
