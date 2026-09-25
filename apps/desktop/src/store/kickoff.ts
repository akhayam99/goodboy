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

const QUESTION_PROTOCOL =
  '**Questions** a question in plain prose never reaches the user. When you need the user to answer, approve or confirm something before you can go on (a destructive command, a choice only they can make), ask it in one `<<ctx-question blocking="true">>the question<</ctx-question>>` block and stop.';

export const composeUnitBoundary = ({ unit, marker }: BoundaryParams): string =>
  `**Scope** this ${unit} only, never a later one. Emit \`${marker}\` on its own line once it is truly done.\n\n${QUESTION_PROTOCOL}`;

const stepBoundaryMarker = (agentId: AgentId): string => `<<step-done id="${agentId}">>`;

export const composeStepBoundary = (agentId: AgentId): string =>
  composeUnitBoundary({ unit: 'step', marker: stepBoundaryMarker(agentId) });
