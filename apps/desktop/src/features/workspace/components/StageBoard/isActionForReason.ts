import type { SessionAttentionReason } from '@goodboy/types';

type Params = {
  readonly actionKey: string;
  readonly reason: SessionAttentionReason;
};

export const isActionForReason = ({ actionKey, reason }: Params): boolean =>
  actionKey === `attention:${reason}` || (actionKey === 'questions' && reason === 'open-question');
