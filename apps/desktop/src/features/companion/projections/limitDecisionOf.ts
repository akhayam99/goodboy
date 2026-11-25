import { formatUsd } from '@goodboy/ui';
import type { LimitDecision } from '../contract/decisions';
import { limitOffersOf } from '../actions/actionLimits';
import { actionIdOf } from './actionIdOf';
import type { WorkspaceScope } from './workspaceScope';

type Params = {
  readonly scope: WorkspaceScope;
  readonly sessionId: string;
};

export const limitDecisionOf = ({ scope, sessionId }: Params): LimitDecision | null => {
  const budget = scope.budgets[sessionId];
  const session = scope.sessions.find((candidate) => candidate.id === sessionId);
  if (budget === undefined || session === undefined) {
    return null;
  }
  const paused = session.workflowRuns.find(
    (run) =>
      run.discardedAt == null &&
      (run.orchestrationStop?.kind === 'paused' || run.orchestrationStop?.kind === 'operator'),
  );
  const runId =
    paused?.id ??
    scope.trees[sessionId]?.[0]?.tree.id ??
    session.workflowRuns.filter((run) => run.discardedAt == null).at(-1)?.id;
  if (runId === undefined) {
    return null;
  }
  const offers = limitOffersOf({ currentLimit: budget.softCapUsd });
  if (offers.length === 0) {
    return null;
  }
  return {
    kind: 'limit',
    actionId: actionIdOf({
      kind: 'raiseLimit',
      objectId: runId,
      version: String(budget.softCapUsd),
    }),
    runId,
    currentLimit: budget.softCapUsd,
    currentLimitText: formatUsd(budget.softCapUsd),
    offers: offers.map((amount) => ({ amount, text: formatUsd(amount) })),
  };
};
