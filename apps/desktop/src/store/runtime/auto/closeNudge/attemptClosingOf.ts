import { closingAfterNudge, parseChildClosing, type ChildClosing } from '@goodboy/core/auto';
import type { AutoAttempt, AutoDelegation } from '@goodboy/db';
import { closeNudgeOf } from '../attemptBaseline';
import type { ChildTurnEnded } from '../ports';

export type AttemptClosingOfParams = Readonly<{
  ended: ChildTurnEnded;
  delegation: AutoDelegation;
  attempt: AutoAttempt;
}>;

export const attemptClosingOf = ({
  ended,
  delegation,
  attempt,
}: AttemptClosingOfParams): ChildClosing => {
  const closing = parseChildClosing({
    text: ended.assistantText,
    childAgentId: delegation.childAgentId,
  });
  const nudge = closeNudgeOf({ baseline: attempt.baseline });
  return nudge === null ? closing : closingAfterNudge({ closing, earlier: nudge.tail });
};
