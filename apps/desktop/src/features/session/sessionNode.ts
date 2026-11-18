import type { Tone } from '@goodboy/ui';
import type { SessionAttentionReason, SessionStageInfo } from '@goodboy/types';
import { NAMES } from '../../shared/utils/names';
import { ATTENTION_REASON_META, attentionWordsOf } from './session-stage';

type SessionNodeKind = 'needs' | 'queue' | 'running' | 'done' | 'idle' | 'archived';

export type SessionNode = {
  readonly kind: SessionNodeKind;
  readonly reason: SessionAttentionReason | null;
  readonly tone: Tone;
  readonly label: string;
  readonly isClosed: boolean;
  readonly hasUnread: boolean;
};

type SessionNodeInfo = Pick<
  SessionStageInfo,
  | 'stage'
  | 'attention'
  | 'isRunning'
  | 'otherReasons'
  | 'openQuestionCount'
  | 'fixNeedsYouCount'
  | 'fixCouldntFixCount'
  | 'noteNeedsYouCount'
  | 'noteCouldntFixCount'
> &
  Partial<Pick<SessionStageInfo, 'prState'>>;

type Params = {
  readonly info: SessionNodeInfo;
  readonly isArchived: boolean;
};

const STAGE_LABEL: Record<'review' | 'building', string> = {
  review: NAMES.inReview,
  building: NAMES.building,
};

export const sessionNodeOf = ({ info, isArchived }: Params): SessionNode => {
  const { stage, attention, otherReasons = [] } = info;
  const hasUnread = attention === 'unread-reply' || otherReasons.includes('unread-reply');
  if (isArchived) {
    return {
      kind: 'archived',
      reason: null,
      tone: 'neutral',
      label: 'Archived',
      isClosed: false,
      hasUnread: false,
    };
  }
  if (stage === 'attention') {
    if (attention === null) {
      return {
        kind: 'needs',
        reason: null,
        tone: 'warning',
        label: NAMES.needsYou,
        isClosed: false,
        hasUnread,
      };
    }
    return {
      kind: 'needs',
      reason: attention,
      tone: ATTENTION_REASON_META[attention].tone,
      label: attentionWordsOf({ reason: attention, counts: info }),
      isClosed: false,
      hasUnread,
    };
  }
  if (stage === 'review' && attention === 'pr-queued') {
    return {
      kind: 'queue',
      reason: attention,
      tone: ATTENTION_REASON_META[attention].tone,
      label: attentionWordsOf({ reason: attention, counts: info }),
      isClosed: false,
      hasUnread,
    };
  }
  if (stage === 'running') {
    return {
      kind: 'running',
      reason: null,
      tone: 'info',
      label: NAMES.running,
      isClosed: false,
      hasUnread,
    };
  }
  if (stage === 'done') {
    const isClosed = info.prState === 'closed';
    return {
      kind: 'done',
      reason: null,
      tone: isClosed ? 'neutral' : 'merged',
      label: NAMES.done,
      isClosed,
      hasUnread,
    };
  }
  return {
    kind: 'idle',
    reason: null,
    tone: 'neutral',
    label: STAGE_LABEL[stage],
    isClosed: false,
    hasUnread,
  };
};
