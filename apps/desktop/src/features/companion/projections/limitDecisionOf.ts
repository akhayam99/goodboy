import { formatUsd } from '@goodboy/ui';
import type { LimitDecision } from '../contract/decisions';
import { limitOffersOf } from '../actions/actionLimits';
import { limitTargetOf } from '../actions/limitTargets';
import { actionIdOf } from './actionIdOf';
import type { WorkspaceScope } from './workspaceScope';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';

type Params = {
  readonly scope: WorkspaceScope;
  readonly sessionId: string;
};

export const limitDecisionOf = ({ scope, sessionId }: Params): LimitDecision | null => {
  const session = sessionById(scope.sessions, sessionId);
  if (session === undefined) {
    return null;
  }
  const paused = session.workflowRuns.find(
    (run) =>
      run.discardedAt == null &&
      (run.orchestrationStop?.kind === 'paused' ||
        run.orchestrationStop?.kind === 'operator' ||
        run.orchestrationStop?.kind === 'budget'),
  );
  const runId =
    paused?.id ??
    scope.trees[sessionId]?.[0]?.tree.id ??
    session.workflowRuns.filter((run) => run.discardedAt == null).at(-1)?.id;
  if (runId === undefined) {
    return null;
  }
  const target = limitTargetOf({ scope, sessionId, runId });
  if (target === null) {
    return null;
  }
  const offers = limitOffersOf({ currentLimit: target.limit });
  if (offers.length === 0) {
    return null;
  }
  return {
    kind: 'limit',
    actionId: actionIdOf({
      kind: 'raiseLimit',
      objectId: runId,
      version: String(target.limit),
    }),
    runId,
    currentLimit: target.limit,
    currentLimitText: formatUsd(target.limit),
    offers: offers.map((amount) => ({ amount, text: formatUsd(amount) })),
  };
};
