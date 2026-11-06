import type { MountId, SessionId } from '@goodboy/types';
import type { NotificationPlaceReason } from '../../../session/notificationPlaceReason';
import type { AppState } from '../../../../store/types';
import { requestHostOf } from '../../../../store/slices/review-source/requestHostOf';
import { attentionPlace } from '../../../session/attentionPlace';
import { attentionPlaceLabelOf } from '../../../session/attentionPlaceLabel';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly reason: NotificationPlaceReason;
  readonly mountId: MountId | null;
  readonly subject?: 'note' | 'comment';
};

export const openPlaceLabelOf = ({ state, sessionId, reason, mountId, subject }: Params): string =>
  attentionPlaceLabelOf({
    reason,
    host: requestHostOf({ state, sessionId, ...(mountId === null ? {} : { mountId }) }),
    place: attentionPlace({ state, sessionId, reason, mountId, subject }),
  });
