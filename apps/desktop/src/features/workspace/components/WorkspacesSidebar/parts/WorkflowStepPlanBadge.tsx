import type { Agent } from '@goodboy/types';
import { cn, tintClasses } from '@goodboy/ui';
import { useAppStore, useSessionPlans } from '../../../../../store';
import { kindConsumesPlan, type AgentKind } from '../../../../session/agent-kind';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../shared/components/conceptIcons';

const planTint = tintClasses(CONCEPT_TONE.plans);

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
      aria-label={`Open ${label.toLowerCase()}: ${plan.title}`}
      className={cn(
        'flex max-w-full shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs text-muted-foreground transition-colors',
        planTint.bgSoft,
        planTint.borderSoft,
        planTint.hoverBgSoft,
        planTint.hoverText,
      )}
    >
      <CONCEPT_ICONS.plans
        size={ICON_SIZE.row}
        aria-hidden
        className={cn('shrink-0', planTint.icon)}
      />
      <span className="shrink-0 font-medium">{label}</span>
      <span className="max-w-[24ch] truncate">{plan.title}</span>
    </button>
  );
};
