import type { Tone, WorkNodeMark, WorkNodeState } from '@goodboy/ui';
import type { SessionStageInfo } from '@goodboy/types';
import { NAMES } from '../../../../shared/names';
import {
  ATTENTION_REASON_META,
  attentionWordsOf,
  type AttentionMark,
} from '../../../session/session-stage';

type SessionNodeKind = 'needs' | 'running' | 'done' | 'idle' | 'archived';

export type SessionNode = {
  readonly kind: SessionNodeKind;
  readonly state: WorkNodeState;
  readonly mark: WorkNodeMark;
  readonly tone: Tone;
  readonly label: string;
  readonly isSpinning: boolean;
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
>;

type Params = {
  readonly info: SessionNodeInfo;
  readonly isArchived: boolean;
};

const RING_ONLY: WorkNodeMark = { kind: 'glyph', glyph: null };
const RUNNING_DOT: WorkNodeMark = { kind: 'dot' };

type MarkStateParams = {
  readonly mark: AttentionMark;
  readonly tone: Tone;
};

const stateOfMark = ({ mark, tone }: MarkStateParams): WorkNodeState => {
  if (mark === '!') {
    return tone === 'danger' ? 'failed' : 'alert';
  }
  if (mark === '?') {
    return 'question';
  }
  if (mark === 'approval') {
    return 'approval';
  }
  if (mark === 'approved') {
    return 'approved';
  }
  return 'marker';
};

const STAGE_LABEL: Record<'review' | 'building', string> = {
  review: NAMES.inReview,
  building: NAMES.building,
};

export const sessionNodeOf = ({ info, isArchived }: Params): SessionNode => {
  const { stage, attention, isRunning = false, otherReasons = [] } = info;
  const hasUnread = attention === 'unread-reply' || otherReasons.includes('unread-reply');
  if (isArchived) {
    return {
      kind: 'archived',
      state: 'queued',
      mark: RING_ONLY,
      tone: 'neutral',
      label: 'Archived',
      isSpinning: false,
      hasUnread: false,
    };
  }
  if (stage === 'attention') {
    if (attention === null) {
      return {
        kind: 'needs',
        state: 'question',
        mark: RING_ONLY,
        tone: 'warning',
        label: NAMES.needsYou,
        isSpinning: isRunning,
        hasUnread,
      };
    }
    const meta = ATTENTION_REASON_META[attention];
    return {
      kind: 'needs',
      state: stateOfMark({ mark: meta.mark, tone: meta.tone }),
      mark: RING_ONLY,
      tone: meta.tone,
      label: attentionWordsOf({ reason: attention, counts: info }),
      isSpinning: isRunning,
      hasUnread,
    };
  }
  if (stage === 'running') {
    return {
      kind: 'running',
      state: 'running',
      mark: RUNNING_DOT,
      tone: 'info',
      label: NAMES.running,
      isSpinning: false,
      hasUnread,
    };
  }
  if (stage === 'done') {
    return {
      kind: 'done',
      state: 'closed',
      mark: RING_ONLY,
      tone: 'neutral',
      label: NAMES.done,
      isSpinning: false,
      hasUnread,
    };
  }
  return {
    kind: 'idle',
    state: 'marker',
    mark: RING_ONLY,
    tone: 'neutral',
    label: STAGE_LABEL[stage],
    isSpinning: false,
    hasUnread,
  };
};
