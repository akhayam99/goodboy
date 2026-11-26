import type { SlackDecision } from '../contract/decisions';
import { slackDraftVersionOf } from '../actions/versions';
import { actionIdOf } from './actionIdOf';
import { safeTextOf } from './safeTextOf';
import type { WorkspaceScope } from './workspaceScope';

type Params = {
  readonly scope: WorkspaceScope;
  readonly sessionId: string;
};

export const slackDecisionOf = ({ scope, sessionId }: Params): SlackDecision | null => {
  const draft = (scope.slackDrafts[sessionId] ?? []).find(
    (candidate) => candidate.status === 'pending',
  );
  if (draft === undefined) {
    return null;
  }
  const version = slackDraftVersionOf({ draft });
  return {
    kind: 'slack',
    actionId: actionIdOf({ kind: 'answerSlackReply', objectId: draft.id, version }),
    draftId: draft.id,
    version,
    draft: safeTextOf({ text: draft.body, max: 1200 }),
  };
};
