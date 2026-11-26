import type { OpenQuestion } from '@goodboy/types';
import type { NeedsYouMove } from '../../board/needsYou/needsYouOf';
import type { Decision } from '../contract/decisions';
import { limitDecisionOf } from './limitDecisionOf';
import { permissionDecisionOf } from './permissionDecisionOf';
import { planDecisionOf } from './planDecisionOf';
import { questionDecisionOf } from './questionDecisionOf';
import { runDecisionOf } from './runDecisionOf';
import { slackDecisionOf } from './slackDecisionOf';
import type { WorkspaceScope } from './workspaceScope';

type Params = {
  readonly scope: WorkspaceScope;
  readonly move: NeedsYouMove;
  readonly question: OpenQuestion | undefined;
};

export const decisionOfMove = ({ scope, move, question }: Params): Decision | null => {
  const sessionId = move.sessionId;
  if (move.reason === 'open-question') {
    return question === undefined || move.questionId === null
      ? null
      : questionDecisionOf({ question });
  }
  if (move.reason === 'plan-approval') {
    return planDecisionOf({ scope, sessionId });
  }
  if (move.reason === 'needs-approval') {
    return permissionDecisionOf({ scope, sessionId });
  }
  if (move.reason === 'run-paused-at-limit') {
    return limitDecisionOf({ scope, sessionId });
  }
  if (move.reason === 'slack-reply-waiting') {
    return slackDecisionOf({ scope, sessionId });
  }
  if (move.reason === 'run-stopped' || move.reason === 'run-waits-for-go') {
    return runDecisionOf({ scope, sessionId });
  }
  return null;
};
