import { useMemo } from 'react';
import { AlertTriangle, Play } from 'lucide-react';
import { ConfirmPopover, cn, tintClasses } from '@goodboy/ui';
import { classifyWorkflowChain, getModelDescriptor } from '@goodboy/core';
import type {
  Agent,
  EffortLevel,
  ProviderId,
  RoleModelPreferences,
  Step,
  VerbosityLevel,
  Workflow,
} from '@goodboy/types';
import { classifyStep } from '../../../../features/session/agent-kind';
import { resolveStepRouting } from '../../resolveStepRouting';
import { RoutingLabel } from '../../../../shared/components/RoutingLabel';
import type { WorkflowBlockReason } from '../../advanceGate';
import { WORKFLOW_BLOCK_COPY } from '../../blockCopy';
import { useStartAnywayConfirm } from '../../useStartAnywayConfirm';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';

const planTint = tintClasses(CONCEPT_TONE.plans);

type AdvanceParams = {
  readonly step: Step;
  readonly model: string;
  readonly verbosity: VerbosityLevel | undefined;
  readonly isConfirmed: boolean;
};

export type Props = {
  readonly workflow: Workflow;
  readonly runs: ReadonlyArray<Agent>;
  readonly onAdvance: (params: AdvanceParams) => void | Promise<void>;
  readonly blockReason?: WorkflowBlockReason | null;
  readonly consumesActivePlan?: boolean;
  readonly className?: string;
  readonly roleModels?: RoleModelPreferences | null;
  readonly agentModel?: string | null;
  readonly agentProvider?: ProviderId | null;
  readonly agentEffort?: EffortLevel | null;
  readonly sessionProvider?: ProviderId | null;
  readonly sessionEffort?: EffortLevel | null;
};

export const WorkflowNextStepCta = ({
  workflow,
  runs,
  onAdvance,
  blockReason = null,
  consumesActivePlan = false,
  className,
  roleModels = null,
  agentModel = null,
  agentProvider = null,
  agentEffort = null,
  sessionProvider = null,
  sessionEffort = null,
}: Props) => {
  const chain = useMemo(() => classifyWorkflowChain(workflow, runs), [workflow, runs]);
  const next = chain.kind === 'step' ? chain.step : null;
  const kind = useMemo(() => (next != null ? classifyStep({ step: next }) : 'generic'), [next]);
  const routing = resolveStepRouting({
    step: next,
    kind,
    roleModels,
    agentModel,
    agentProvider,
    agentEffort,
    sessionProvider,
    sessionEffort,
  });
  const effortText = routing.effort ?? 'model default';
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
  if (next == null) {
    return null;
  }
  const pendingAgent = runs.find((agent) => agent.stepId === next.id && agent.status === 'pending');
  if (pendingAgent == null) {
    return null;
  }
  const stepVerbosity = next.verbosity;
  return (
    <div className={className}>
      <ConfirmPopover
        role="alert"
        icon={<AlertTriangle size={ICON_SIZE.row} />}
        title={advance.title}
        description={advance.description}
        confirmLabel={advance.confirmLabel}
        cancelLabel={advance.cancelLabel}
        isBusy={advance.isBusy}
        isOpen={advance.isConfirming}
        onConfirm={advance.onConfirm}
        onCancel={advance.onCancel}
        anchorClassName="flex min-w-0"
        trigger={() => (
          <button
            type="button"
            onClick={advance.onTrigger}
            disabled={advance.isBusy}
            data-testid="workflow-next-step-cta"
            title={
              blockReason != null
                ? WORKFLOW_BLOCK_COPY[blockReason]
                : `effort: ${effortText}${stepVerbosity ? ` · verbosity: ${stepVerbosity}` : ''}`
            }
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2 py-1 text-secondary font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              blockReason != null
                ? cn(
                    tintClasses('warning').border,
                    tintClasses('warning').bg,
                    'text-warning hover:border-warning',
                    tintClasses('warning').hoverBg,
                  )
                : cn(
                    tintClasses('primary').border,
                    tintClasses('primary').bg,
                    'text-primary hover:border-primary',
                    tintClasses('primary').hoverBg,
                  ),
            )}
            aria-label={`Run next step: ${next.name} (${getModelDescriptor(routing.model)?.label ?? routing.model}, ${effortText} effort${stepVerbosity ? `, ${stepVerbosity} verbosity` : ''})${blockReason != null ? `. Blocked: ${WORKFLOW_BLOCK_COPY[blockReason]}` : ''}`}
          >
            {blockReason != null ? (
              <AlertTriangle
                size={ICON_SIZE.row}
                aria-hidden
                className="shrink-0"
                data-testid="workflow-next-step-blocked"
              />
            ) : (
              <Play size={ICON_SIZE.row} aria-hidden className="shrink-0" />
            )}
            <span className="truncate">Run next step: {next.name}</span>
            <RoutingLabel
              className="shrink-0 opacity-70"
              model={routing.model}
              effort={routing.effort}
            />
            {consumesActivePlan ? (
              <span className="shrink-0" title="Advancing will consume the active plan">
                <CONCEPT_ICONS.plans size={11} aria-hidden className={planTint.icon} />
              </span>
            ) : null}
          </button>
        )}
      />
    </div>
  );
};
