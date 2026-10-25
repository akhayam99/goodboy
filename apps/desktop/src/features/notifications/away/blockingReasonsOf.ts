import type { SessionAttentionReason, SessionStageInfo } from '@goodboy/types';
import { attentionReasonsOf } from '../../../store/slices/session-view/attentionReasonsOf';

const BLOCKING_REASONS: ReadonlySet<SessionAttentionReason> = new Set<SessionAttentionReason>([
  'open-question',
  'needs-approval',
  'plan-approval',
  'agent-error',
  'push-failed',
  'ci-failed',
]);

type Params = {
  readonly info: SessionStageInfo;
};

export const blockingReasonsOf = ({ info }: Params): ReadonlyArray<SessionAttentionReason> =>
  attentionReasonsOf({ info }).filter((reason) => BLOCKING_REASONS.has(reason));
