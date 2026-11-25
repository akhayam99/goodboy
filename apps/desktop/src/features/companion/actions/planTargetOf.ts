import type { AgentId, ArtifactId, SessionId } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import { planApprovalInViewOf } from '../../auto/chat/planApprovalInViewOf';
import { PLAN_REVISING_REASON } from '../../plans/planRevising';
import type { HandlerResult } from './handlerTypes';
import { refusedResult } from './handlerResults';

export type PlanTarget = {
  readonly artifactId: ArtifactId;
  readonly rootAgentId: AgentId;
  readonly revision: number;
};

export type PlanTargetResult =
  | { readonly isFound: true; readonly target: PlanTarget }
  | { readonly isFound: false; readonly result: HandlerResult };

type Params = {
  readonly store: AppStore;
  readonly sessionId: SessionId;
  readonly planId: string;
  readonly seenPlanVersion: number;
};

export const planTargetOf = ({
  store,
  sessionId,
  planId,
  seenPlanVersion,
}: Params): PlanTargetResult => {
  for (const view of store.autoTreeViews?.[sessionId] ?? []) {
    const row = view.artifacts.find((candidate) => candidate.artifact.artifactId === planId);
    if (row === undefined) {
      continue;
    }
    const approval = planApprovalInViewOf({ view, row });
    if (approval?.state === 'approved' || approval?.state === 'used') {
      return {
        isFound: false,
        result: refusedResult({
          code: 'already-decided',
          message: 'This plan was already decided on your Mac.',
        }),
      };
    }
    if (approval?.state === 'revising') {
      return {
        isFound: false,
        result: refusedResult({ code: 'version-changed', message: PLAN_REVISING_REASON }),
      };
    }
    if (approval?.state !== 'needs_approval' || row.revision !== seenPlanVersion) {
      return {
        isFound: false,
        result: refusedResult({
          code: 'version-changed',
          message: `Plan v${seenPlanVersion} is no longer current.`,
          changes: [
            {
              label: 'Plan',
              was: `v${seenPlanVersion}`,
              now: approval?.state === 'superseded' ? 'Superseded' : `v${row.revision}`,
            },
          ],
        }),
      };
    }
    return {
      isFound: true,
      target: {
        artifactId: brandId<ArtifactId>({ value: planId }),
        rootAgentId: view.tree.rootAgentId,
        revision: row.revision,
      },
    };
  }
  return {
    isFound: false,
    result: refusedResult({ code: 'unknown-target', message: 'This plan is not on your Mac.' }),
  };
};
