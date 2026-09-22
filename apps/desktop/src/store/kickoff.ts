import type { AgentId, PlanWithCount, SessionId, WorkflowRunId } from '@goodboy/types';
import { listPlansForSession as invokeListPlansForSession } from '../features/plans/plans';

export const composePlanSection = ({ bodyMd }: { readonly bodyMd: string }): string =>
  `**Plan**\n${bodyMd}`;

export const buildPlanKickoffSection = async (
  sessionId: SessionId,
  workflowRunId?: WorkflowRunId,
): Promise<{ section: string; plan: PlanWithCount | null }> => {
  try {
    const plans = await invokeListPlansForSession(sessionId);
    const scoped = workflowRunId ? plans.filter((p) => p.workflowRunId === workflowRunId) : plans;
    const latest = scoped[scoped.length - 1] ?? null;
    if (!latest || latest.status !== 'active') {
      return { section: '', plan: latest };
    }
    return {
      section: composePlanSection({ bodyMd: latest.bodyMd }),
      plan: latest,
    };
  } catch {
    return { section: '', plan: null };
  }
};

export const composeKickoff = (...sections: ReadonlyArray<string>): string =>
  sections.filter((s) => s.length > 0).join('\n\n');

export const buildGoalKickoffSection = (goal?: string): string => {
  const trimmed = (goal ?? '').trim();
  return trimmed.length > 0 ? `**Goal** ${trimmed}` : '';
};

type BoundaryParams = {
  readonly unit: string;
  readonly marker: string;
};

export const composeUnitBoundary = ({ unit, marker }: BoundaryParams): string =>
  `**Scope** this ${unit} only, never a later one. Emit \`${marker}\` on its own line once it is truly done.`;

export const composeClusterOutcomeBoundary = ({ agentId }: { readonly agentId: AgentId }): string =>
  `**Outcome** emit one line \`<<cluster-outcome>>{"v":1,"id":"${agentId}","status":"clear"}<</cluster-outcome>>\` when no work remains for another agent. If you found work that still needs an owner, emit one line \`<<cluster-outcome>>{"v":1,"id":"${agentId}","status":"unresolved","findings":[{"reason":"short reason","target":"implementer"}]}<</cluster-outcome>>\` instead. Each target is implementer, planner, investigator, or tester. Emit the outcome beside the cluster boundary even when this cluster is review work.`;

const stepBoundaryMarker = (agentId: AgentId): string => `<<step-done id="${agentId}">>`;

export const composeStepBoundary = (agentId: AgentId): string =>
  composeUnitBoundary({ unit: 'step', marker: stepBoundaryMarker(agentId) });
