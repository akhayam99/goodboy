import type { Agent } from '@goodboy/types';
import { useAppStore, useSessionPlans } from '../../../../../store';
import { kindConsumesPlan, type AgentKind } from '../../../../session/agent-kind';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly run: Agent;
  readonly kind: AgentKind;
};

export const WorkflowStepPlanBadge = ({ run, kind }: Props) => {
  const plans = useSessionPlans(run.sessionId);
  const planConsumptions = useAppStore((state) => state.planConsumptions);
  const plannerPlan =
    kind === 'planner' ? [...plans].reverse().find((plan) => plan.agentId === run.id) : undefined;
  const consumedPlan = kindConsumesPlan(kind)
    ? [...plans]
        .reverse()
        .find((plan) =>
          (planConsumptions[plan.id] ?? []).some((consumption) => consumption.agentId === run.id),
        )
    : undefined;
  const runPlans =
    run.workflowRunId != null
      ? plans.filter((plan) => plan.workflowRunId === run.workflowRunId)
      : [];
  const hasRunConsumptions = runPlans.some((plan) => (planConsumptions[plan.id]?.length ?? 0) > 0);
  const fallbackPlan =
    kindConsumesPlan(kind) &&
    consumedPlan == null &&
    !hasRunConsumptions &&
    (run.status === 'running' || run.status === 'completed') &&
    run.workflowRunId != null
      ? runPlans[runPlans.length - 1]
      : undefined;
  const plan = plannerPlan ?? consumedPlan ?? fallbackPlan;

  if (plan == null) {
    return null;
  }

  const label = kind === 'planner' ? 'Plan' : 'From plan';
  const onOpen = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-plan-studio', {
        detail: { sessionId: run.sessionId, planId: plan.id },
      }),
    );
  };

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      title={plan.title}
      aria-label={`open ${label.toLowerCase()}: ${plan.title}`}
      className="flex max-w-full shrink-0 items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-2xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <CONCEPT_ICONS.plans size={12} aria-hidden className="shrink-0" />
      <span className="shrink-0 font-medium">{label}</span>
      <span className="max-w-[24ch] truncate">{plan.title}</span>
    </button>
  );
};
