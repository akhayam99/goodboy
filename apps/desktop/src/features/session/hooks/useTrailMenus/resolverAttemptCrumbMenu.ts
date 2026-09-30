import type { CrumbMenuModel } from '@goodboy/ui';
import { resolverPagePlace } from '../../../../store/slices/navigation/place';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { RESOLVE_ITEM_LABEL } from '../../../resolve/resolveItemCopy';
import { threadLocationOf } from '../../../resolve/threadLocationOf';
import { attemptMenu } from '../../trail/menus/attemptMenu';
import { resolveAgainActions } from '../../trail/menus/crumbActions';
import type { TrailMenuScope } from './trailMenuScope';

export const resolverAttemptCrumbMenu = (scope: TrailMenuScope): CrumbMenuModel | null => {
  const { sessionId, selected, threadId, resolvers, queueRows, resolveAttempts } = scope;
  if (selected === null || threadId === null || !resolvers.has(selected.id)) {
    return null;
  }
  const nowMs = Date.now();
  const row = queueRows.find((candidate) => candidate.thread.threadId === threadId) ?? null;
  const threadAttempts = resolveAttempts.filter((attempt) => attempt.threadIds.includes(threadId));
  return attemptMenu({
    attempts: threadAttempts,
    threadLabel: row === null ? 'Comment' : (threadLocationOf({ row })?.shortLabel ?? 'Comment'),
    currentAgentId: selected.id,
    ageOf: (ms) => formatAge({ from: new Date(ms).toISOString(), now: nowMs }),
    actions: resolveAgainActions({
      attempts: threadAttempts,
      onRun: () =>
        void scope.resolveAgain({
          threadId,
          instruction: RESOLVE_ITEM_LABEL.rereadInstruction,
        }),
    }),
    onSelect: (attempt) =>
      scope.navigate({
        to: resolverPagePlace({ sessionId, agentId: attempt.agentId, threadId }),
      }),
  });
};
