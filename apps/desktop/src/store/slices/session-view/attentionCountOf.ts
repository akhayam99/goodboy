import type { SessionAttentionReason, SessionStageInfo } from '@goodboy/types';
import { ATTENTION_REASON_META } from '../../../features/session/session-stage';
import { attentionReasonsOf } from './attentionReasonsOf';

type AttentionTone = 'danger' | 'warning';

type AttentionItem = {
  readonly id: string;
  readonly info: SessionStageInfo;
};

export type AttentionCount = {
  readonly count: number;
  readonly quietCount: number;
  readonly tone: AttentionTone | null;
  readonly countedIds: ReadonlyArray<string>;
};

type Params = {
  readonly items: ReadonlyArray<AttentionItem>;
};

type InfoParams = {
  readonly info: SessionStageInfo;
};

const NOTHING: AttentionCount = { count: 0, quietCount: 0, tone: null, countedIds: [] };

type ReasonParams = {
  readonly reason: SessionAttentionReason;
};

const isLoud = ({ reason }: ReasonParams): boolean => {
  const { tone } = ATTENTION_REASON_META[reason];
  return tone === 'warning' || tone === 'danger';
};

const isCounted = ({ info }: InfoParams): boolean =>
  info.stage === 'attention' && attentionReasonsOf({ info }).some((reason) => isLoud({ reason }));

const isQuiet = ({ info }: InfoParams): boolean =>
  info.stage === 'attention' && !isCounted({ info });

const hasDanger = ({ info }: InfoParams): boolean =>
  attentionReasonsOf({ info }).some((reason) => ATTENTION_REASON_META[reason].tone === 'danger');

export const attentionCountOf = ({ items }: Params): AttentionCount => {
  const counted = items.filter((item) => isCounted({ info: item.info }));
  const quietCount = items.filter((item) => isQuiet({ info: item.info })).length;
  if (counted.length === 0 && quietCount === 0) {
    return NOTHING;
  }
  return {
    count: counted.length,
    quietCount,
    tone:
      counted.length === 0
        ? null
        : counted.some((item) => hasDanger({ info: item.info }))
          ? 'danger'
          : 'warning',
    countedIds: counted.map((item) => item.id),
  };
};
