import { Fragment } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Agent, AgentId, RoleModelPreferences, Step, Workflow } from '@goodboy/types';
import { inferAgentKindFromName, type AgentKind } from '../../../session/agent-kind';
import { resolveStepRouting } from '../../resolveStepRouting';
import { WorkflowStepStripItem } from './WorkflowStepStripItem';

type Props = {
  readonly workflow: Workflow;
  readonly runs: ReadonlyArray<Agent>;
  readonly childrenByParentId: ReadonlyMap<string, ReadonlyArray<Agent>>;
  readonly agentKindOverride: Readonly<Record<string, AgentKind>>;
  readonly agentModelOverride: Readonly<Record<string, string>>;
  readonly roleModels: RoleModelPreferences | null;
  readonly selectedAgentId: AgentId | null;
  readonly onSelect: (id: AgentId) => void;
};

export const WorkflowStepStrip = ({
  workflow,
  runs,
  childrenByParentId,
  agentKindOverride,
  agentModelOverride,
  roleModels,
  selectedAgentId,
  onSelect,
}: Props) => {
  const stepById = new Map<string, Step>(workflow.steps.map((step) => [step.id, step]));
  const sortedRuns = [...runs].sort((first, second) => first.ordinal - second.ordinal);

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      aria-label="workflow steps"
      data-testid="workflow-step-strip"
    >
      {sortedRuns.map((run, index) => {
        const kind = agentKindOverride[run.id] ?? inferAgentKindFromName(run.name);
        const step = run.stepId == null ? null : (stepById.get(run.stepId) ?? null);
        const model = resolveStepRouting({
          step,
          kind,
          roleModels,
          agentModel: agentModelOverride[run.id] ?? run.modelOverride,
        }).model;

        return (
          <Fragment key={run.id}>
            {index > 0 ? (
              <ArrowRight size={13} aria-hidden className="shrink-0 text-muted-foreground/35" />
            ) : null}
            <WorkflowStepStripItem
              run={run}
              kind={kind}
              model={model}
              children={childrenByParentId.get(run.id) ?? []}
              isSelected={selectedAgentId === run.id}
              onSelect={() => onSelect(run.id)}
            />
          </Fragment>
        );
      })}
    </div>
  );
};
