import { useMemo, useState } from 'react';
import { AlertTriangle, Play } from 'lucide-react';
import { InlineConfirm, cn } from '@goodboy/ui';
import { classifyWorkflowChain, getModelDescriptor } from '@goodboy/core';
import type { Agent, RoleModelPreferences, Step, Workflow } from '@goodboy/types';
import type { VerbosityLevel } from '../../../../features/settings/verbosity';
import { inferAgentKindFromName } from '../../../../features/session/agent-kind';
import { resolveStepRouting } from '../../resolveStepRouting';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
import type { WorkflowBlockReason } from '../../advanceGate';
import { WORKFLOW_BLOCK_COPY } from '../../blockCopy';
import { useStartAnywayConfirm } from '../../useStartAnywayConfirm';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

export type AdvanceParams = {
  readonly step: Step;
  readonly model: string;
  readonly verbosity: VerbosityLevel | undefined;
  readonly isConfirmed: boolean;
};

export type Props = {
  readonly workflow: Workflow;
  readonly runs: ReadonlyArray<Agent>;
  readonly onAdvance: (params: AdvanceParams) => void | Promise<void>;
  readonly onForceAdvance?: () => void | Promise<void>;
  readonly blockReason?: WorkflowBlockReason | null;
  readonly consumesActivePlan?: boolean;
  readonly className?: string;
  readonly roleModels?: RoleModelPreferences | null;
};

export type PickNextWorkflowStepGate = {
  readonly hasOpenQuestions?: boolean;
  readonly summarizerBusy?: boolean;
};

export const pickNextWorkflowStep = (
  workflow: Workflow,
  runs: ReadonlyArray<Agent>,
  gate?: PickNextWorkflowStepGate,
): Step | null => {
  if (gate?.hasOpenQuestions || gate?.summarizerBusy) {
    return null;
  }
  const sorted = [...workflow.steps].sort((a, b) => a.ordinal - b.ordinal);
  for (const step of sorted) {
    const agent = runs.find((r) => r.stepId === step.id);
    if (!agent || agent.status !== 'pending') {
      continue;
    }
    const prevSteps = sorted.filter((s) => s.ordinal < step.ordinal);
    const allDone = prevSteps.every((s) =>
      runs.some((r) => r.stepId === s.id && (r.status === 'completed' || r.status === 'skipped')),
    );
    if (allDone) {
      return step;
    }
    return null;
  }
  return null;
};

export const WorkflowNextStepCta = ({
  workflow,
  runs,
  onAdvance,
  onForceAdvance,
  blockReason = null,
  consumesActivePlan = false,
  className,
  roleModels = null,
}: Props) => {
  const [busy, setBusy] = useState(false);
  const [pendingForce, setPendingForce] = useState(false);
  const chain = useMemo(() => classifyWorkflowChain(workflow, runs), [workflow, runs]);
  const next = chain.kind === 'step' ? chain.step : null;
  const kind = useMemo(() => (next ? inferAgentKindFromName(next.name) : 'generic'), [next]);
  const routing = resolveStepRouting({ step: next, kind, roleModels });
  const advance = useStartAnywayConfirm({
    blockReason,
    onStart: async ({ isConfirmed }) => {
      if (next == null) {
        return;
      }
      await onAdvance({
        step: next,
        model: routing.model,
        verbosity: next.verbosity,
        isConfirmed,
      });
    },
  });
  const doForce = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setPendingForce(false);
    try {
      await onForceAdvance?.();
    } finally {
      setBusy(false);
    }
  };
  if (chain.kind === 'complete') {
    return null;
  }
  if (chain.kind === 'blocked') {
    return (
      <div className={cn('relative', className)}>
        <button
          type="button"
          onClick={() => setPendingForce(true)}
          disabled={busy}
          data-testid="workflow-force-next-step-cta"
          title={`Step blocked: ${chain.failedStep.name}`}
          className="flex items-center gap-1.5 rounded-md border border-warning/50 bg-warning/10 px-2 py-1 text-2xs font-semibold text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-safe:transition-colors hover:border-warning hover:bg-warning/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <AlertTriangle size={12} aria-hidden className="shrink-0" />
          Skip blocked step
        </button>
        {pendingForce ? (
          <InlineConfirm
            role="alert"
            icon={<AlertTriangle size={12} />}
            title="Skip the blocked step and start the next agent?"
            description={`${chain.failedStep.name} did not finish. Its output will not be carried forward.`}
            confirmLabel="Skip and continue"
            cancelLabel="Cancel"
            isBusy={busy}
            onConfirm={() => void doForce()}
            onCancel={() => setPendingForce(false)}
            className="absolute right-0 top-full z-40 mt-1 w-72 bg-background shadow-lg"
          />
        ) : null}
      </div>
    );
  }
  if (!next) {
    return null;
  }
  const pendingAgent = runs.find((agent) => agent.stepId === next.id && agent.status === 'pending');
  if (pendingAgent == null) {
    return null;
  }
  const stepVerbosity = next.verbosity;
  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={advance.onTrigger}
        disabled={advance.isBusy}
        data-testid="workflow-next-step-cta"
        title={
          blockReason != null
            ? WORKFLOW_BLOCK_COPY[blockReason]
            : `effort: ${routing.effort}${stepVerbosity ? ` · verbosity: ${stepVerbosity}` : ''}`
        }
        className={cn(
          'flex items-center gap-1.5 rounded-md border px-2 py-1 text-2xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-60',
          blockReason != null
            ? 'border-warning/50 bg-warning/10 text-warning hover:border-warning hover:bg-warning/20'
            : 'border-primary/40 bg-primary/10 text-primary hover:border-primary hover:bg-primary/20',
        )}
        aria-label={`Run next step: ${next.name} (${getModelDescriptor(routing.model)?.label ?? routing.model}, ${routing.effort} effort${stepVerbosity ? `, ${stepVerbosity} verbosity` : ''})${blockReason != null ? `. Blocked: ${WORKFLOW_BLOCK_COPY[blockReason]}` : ''}`}
      >
        {blockReason != null ? (
          <AlertTriangle
            size={12}
            aria-hidden
            className="shrink-0"
            data-testid="workflow-next-step-blocked"
          />
        ) : (
          <Play size={12} aria-hidden className="shrink-0" />
        )}
        <span className="truncate">Run next step: {next.name}</span>
        <RoutingBadge
          className="shrink-0 opacity-70"
          model={routing.model}
          effort={routing.effort}
        />
        {consumesActivePlan ? (
          <span className="shrink-0" title="Advancing will consume the active plan">
            <CONCEPT_ICONS.plans size={11} aria-hidden />
          </span>
        ) : null}
      </button>
      {advance.isConfirming ? (
        <InlineConfirm
          role="alert"
          icon={<AlertTriangle size={12} />}
          title={advance.title}
          description={advance.description}
          confirmLabel={advance.confirmLabel}
          cancelLabel={advance.cancelLabel}
          isBusy={advance.isBusy}
          onConfirm={advance.onConfirm}
          onCancel={advance.onCancel}
          className="absolute right-0 top-full z-40 mt-1 w-72 bg-background shadow-lg"
        />
      ) : null}
    </div>
  );
};
