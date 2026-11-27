import type { SessionAttentionReason, SessionStageInfo } from '@goodboy/types';
import { ATTENTION_REASON_META } from '../../session/session-stage';
import { attentionReasonsOf } from '../../../store/slices/session-view/attentionReasonsOf';

type Params = {
  readonly info: SessionStageInfo;
};

export const blockingReasonsOf = ({ info }: Params): ReadonlyArray<SessionAttentionReason> =>
  attentionReasonsOf({ info }).filter((reason) => ATTENTION_REASON_META[reason].isBlocking);
