import type { PlanWithCount, SessionId, WorkflowRunId } from '@goodboy/types';
import { listPlansForSession as invokeListPlansForSession } from '../features/plans/plans';

export const buildPlanKickoffSection = async (
  sessionId: SessionId,
  workflowRunId?: WorkflowRunId,
): Promise<{ section: string; plan: PlanWithCount | null }> => {
  try {
    const plans = await invokeListPlansForSession(sessionId);
    const scoped = workflowRunId ? plans.filter((p) => p.workflowRunId === workflowRunId) : plans;
    const latest = scoped[scoped.length - 1] ?? null;
    if (!latest || latest.status !== 'active') return { section: '', plan: latest };
    return {
      section: ['Active plan to execute:', '', latest.bodyMd].join('\n'),
      plan: latest,
    };
  } catch {
    return { section: '', plan: null };
  }
};

export const composeKickoff = (planSection: string, baseKickoff: string): string => {
  if (planSection.length === 0) return baseKickoff;
  if (baseKickoff.length === 0) return planSection;
  return `${planSection}\n\n${baseKickoff}`;
};
