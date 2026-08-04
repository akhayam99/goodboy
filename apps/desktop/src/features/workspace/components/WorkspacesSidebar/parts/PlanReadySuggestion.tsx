import { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Agent, Session, StepId, Workflow } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionOpenQuestions,
  useSessionPlans,
} from '../../../../../store';
import { workflowHasOpenQuestions } from '../../../../context/openQuestionsGate';
import {
  type AgentKind,
  inferAgentKindFromName,
  kindConsumesPlan,
} from '../../../../session/agent-kind';

type Props = {
  task: Session;
};

export const PlanReadySuggestion = ({ task }: Props) => {
  const plans = useSessionPlans(task.id);
  const openQuestions = useSessionOpenQuestions(task.id);
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[task.id] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const phaseTemplates = useAppStore(
    (s) => s.phaseTemplates[task.workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const runPlan = useAppStore((s) => s.runPlan);
  const [spawning, setSpawning] = useState(false);

  const latest = plans[plans.length - 1];
  if (!latest || latest.status !== 'active') {
    return null;
  }

  const creator = phaseRuns.find((r) => r.id === latest.agentId);
  const creatorWorkflow = creator?.stepId
    ? (phaseTemplates.find((t) => t.steps.some((s) => s.id === creator.stepId)) ?? null)
    : null;
  if (creatorWorkflow) {
    if (workflowHasOpenQuestions(openQuestions, creatorWorkflow.id)) {
      return null;
    }
  } else if (openQuestions.some((q) => q.status === 'open')) {
    return null;
  }

  const liveStepIds = new Set<StepId>();
  for (const run of task.workflowRuns) {
    if (run.discardedAt) {
      continue;
    }
    phaseTemplates
      .find((t) => t.id === run.workflowId)
      ?.steps.forEach((s) => liveStepIds.add(s.id));
  }
  const hasPendingConsumer = phaseRuns.some(
    (a) =>
      a.status === 'pending' &&
      a.stepId !== undefined &&
      liveStepIds.has(a.stepId) &&
      kindConsumesPlan((a.kind as AgentKind | undefined) ?? inferAgentKindFromName(a.name)),
  );
  if (hasPendingConsumer) {
    return null;
  }

  const onSpawn = async () => {
    if (spawning) {
      return;
    }
    setSpawning(true);
    try {
      await runPlan(task.id, latest.id);
    } finally {
      setSpawning(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onSpawn()}
      disabled={spawning}
      data-testid="plan-ready-suggestion"
      title={latest.title}
      aria-label={`Spawn an implementer agent to execute the plan: ${latest.title}`}
      className={cn(
        'group mt-1 flex w-full items-start gap-2 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-2 text-left transition-colors hover:border-primary/60 hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60',
        spawning && 'animate-border-pulse',
      )}
    >
      <span
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary"
        aria-hidden
      >
        <Sparkles size={11} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-3xs font-semibold uppercase tracking-wide text-primary">
          <span>plan ready</span>
          <span aria-hidden className="opacity-40">
            ·
          </span>
          <span className="font-normal normal-case tracking-normal text-muted-foreground">
            spawn implementer
          </span>
        </span>
        <span className="line-clamp-2 text-xs text-foreground/90">{latest.title}</span>
      </span>
      <ArrowRight
        size={12}
        aria-hidden
        className="mt-0.5 shrink-0 text-primary/70 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
      />
    </button>
  );
};
