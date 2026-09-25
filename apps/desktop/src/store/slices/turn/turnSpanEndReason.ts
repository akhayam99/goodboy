import { hasBlockingQuestion } from '@goodboy/core';
import type { AgentTurnSpanEndReason } from '@goodboy/types';

type Params = {
  readonly wasCancelled: boolean;
  readonly assistantText: string;
};

export const turnSpanEndReason = ({
  wasCancelled,
  assistantText,
}: Params): AgentTurnSpanEndReason => {
  if (wasCancelled) {
    return 'cancelled';
  }
  if (assistantText.length === 0) {
    return 'failed';
  }
  return hasBlockingQuestion({ assistantText }) ? 'awaiting_user' : 'succeeded';
};
