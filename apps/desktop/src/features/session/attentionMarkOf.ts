import type { StatusMarkSpec, StatusMarkState } from '@goodboy/ui';
import type { SessionAttentionReason } from '@goodboy/types';
import { ATTENTION_REASON_META, type AttentionMark } from './session-stage';

type Params = {
  readonly reason: SessionAttentionReason;
};

const MARK_STATE: Record<Exclude<AttentionMark, '!' | 'none'>, StatusMarkState> = {
  '?': 'question',
  approval: 'approval',
  queue: 'merging',
  approved: 'approved',
};

export const attentionMarkOf = ({ reason }: Params): StatusMarkSpec => {
  const { mark, tone } = ATTENTION_REASON_META[reason];
  if (mark === 'none') {
    return { kind: 'dot', tone: 'unread' };
  }
  if (mark === '!') {
    return { kind: 'state', state: tone === 'danger' ? 'failed' : 'alert' };
  }
  return { kind: 'state', state: MARK_STATE[mark] };
};
