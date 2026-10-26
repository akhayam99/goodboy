import type { SessionAttentionReason, SessionStageInfo } from '@goodboy/types';

type Params = {
  readonly info: SessionStageInfo;
};

export const attentionReasonsOf = ({ info }: Params): ReadonlyArray<SessionAttentionReason> =>
  info.attention === null ? [] : [info.attention, ...(info.otherReasons ?? [])];
