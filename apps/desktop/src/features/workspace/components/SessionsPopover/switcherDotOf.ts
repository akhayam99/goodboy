import type { SessionStageInfo } from '@goodboy/types';
import { attentionCountOf } from '../../../../store/slices/session-view/attentionCountOf';
import { attentionReasonsOf } from '../../../../store/slices/session-view/attentionReasonsOf';
import { ATTENTION_REASON_META } from '../../../session/session-stage';

export type SwitcherDot = 'warning' | 'info' | null;

type Params = {
  readonly id: string;
  readonly info: SessionStageInfo;
};

export const switcherDotOf = ({ id, info }: Params): SwitcherDot => {
  if (attentionCountOf({ items: [{ id, info }] }).count > 0) {
    const isBroken = attentionReasonsOf({ info }).some(
      (reason) => ATTENTION_REASON_META[reason].tone === 'danger',
    );
    return isBroken ? null : 'warning';
  }
  return info.stage === 'running' ? 'info' : null;
};
