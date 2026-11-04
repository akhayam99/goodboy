import { DECISION_FIRST_RULE } from '@goodboy/core/decisionFirstRule';
import type { Agent, AgentId, PlanWithCount, SessionId, WorkflowRunId } from '@goodboy/types';
import { listPlansForSession as invokeListPlansForSession } from '../../../features/plans/plans';

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
  readonly stuckMarker: string;
};

const QUESTION_PROTOCOL =
  '**Questions** a question in plain prose never reaches the user. When you need the user to answer, approve or confirm something before you can go on (a destructive command, a choice only they can make), ask it in one `<<ctx-question blocking="true">>the question<</ctx-question>>` block and stop. ' +
  DECISION_FIRST_RULE;

export const composeUnitBoundary = ({ unit, marker, stuckMarker }: BoundaryParams): string =>
  `**Scope** this ${unit} only, never a later one. Emit \`${marker}\` on its own line once it is truly done.\n\n**Ending** every turn ends in exactly one of three ways: ${unit} done (\`${marker}\`), ${unit} stuck (\`${stuckMarker}\` with the reason in your own words, when you cannot finish it and nothing can be asked), or one question to the user. Never end a turn with none of them.\n\n${QUESTION_PROTOCOL}`;

const stepBoundaryMarker = (agentId: AgentId): string => `<<step-done id="${agentId}">>`;

export const composeStepBoundary = (agentId: AgentId): string =>
  composeUnitBoundary({
    unit: 'step',
    marker: stepBoundaryMarker(agentId),
    stuckMarker: `<<step-stuck id="${agentId}" reason="why it cannot finish">>`,
  });

type StepResumeParams = {
  readonly agent: Pick<Agent, 'id' | 'stepId' | 'workflowRunId'> | undefined;
  readonly text: string;
};

export const withStepBoundary = ({ agent, text }: StepResumeParams): string =>
  agent?.stepId != null && agent.workflowRunId != null
    ? `${text}\n\n${composeStepBoundary(agent.id)}`
    : text;
