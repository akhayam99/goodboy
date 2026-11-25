import type { HandlerParams, HandlerResult } from './handlerTypes';
import type { DecideActionOf } from './decideAction';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import { planTargetOf } from './planTargetOf';
import { sessionIdOf } from './ids';

export const approvePlan = async ({
  action,
  getStore,
  ports,
}: HandlerParams<DecideActionOf<'approvePlan'>>): Promise<HandlerResult> => {
  const sessionId = sessionIdOf({ value: action.sessionId });
  const found = planTargetOf({
    store: getStore(),
    sessionId,
    planId: action.planId,
    seenPlanVersion: action.seenPlanVersion,
  });
  if (!found.isFound) {
    return found.result;
  }
  try {
    const approval = await ports.approvePlan({
      sessionId,
      rootAgentId: found.target.rootAgentId,
      artifactId: found.target.artifactId,
      expectedRevision: found.target.revision,
    });
    if (approval.kind === 'approved' || approval.kind === 'already_approved') {
      return doneResult();
    }
    if (approval.kind === 'told_failed') {
      return failedResult({
        error: 'Plan approved, but the Lead was not told. Resend on your Mac.',
      });
    }
    return refusedResult({
      code: approval.code === 'stale_revision' ? 'version-changed' : 'already-decided',
      message: approval.message,
    });
  } catch (error) {
    console.error('[bridge] approvePlan failed', error);
    return failedResult({ error: 'Could not approve the plan.' });
  }
};
