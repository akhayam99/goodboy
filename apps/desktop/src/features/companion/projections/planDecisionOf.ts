import type { PlanDecision } from '../contract/decisions';
import { planApprovalInViewOf } from '../../auto/chat/planApprovalInViewOf';
import { actionIdOf } from './actionIdOf';
import { planOutlineOf } from './planOutlineOf';
import { safeTextOf } from './safeTextOf';
import type { WorkspaceScope } from './workspaceScope';

type Params = {
  readonly scope: WorkspaceScope;
  readonly sessionId: string;
};

export const planDecisionOf = ({ scope, sessionId }: Params): PlanDecision | null => {
  for (const view of scope.trees[sessionId] ?? []) {
    for (const row of view.artifacts) {
      if (planApprovalInViewOf({ view, row })?.state !== 'needs_approval') {
        continue;
      }
      const planId = row.artifact.artifactId;
      const outline = planOutlineOf({ source: row.sourceText });
      return {
        kind: 'plan',
        actionId: actionIdOf({
          kind: 'approvePlan',
          objectId: planId,
          version: String(row.revision),
        }),
        planId,
        planVersion: row.revision,
        summary: safeTextOf({ text: row.title, max: 300 }),
        steps: outline.steps,
        touches: outline.touches,
        requestChangesActionId: actionIdOf({
          kind: 'requestPlanChanges',
          objectId: planId,
          version: String(row.revision),
        }),
      };
    }
  }
  return null;
};
