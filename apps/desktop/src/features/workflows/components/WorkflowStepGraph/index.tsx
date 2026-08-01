import type {
  Agent,
  AgentId,
  ProviderId,
  RoleModelPreferences,
  Step,
  Workflow,
} from '@goodboy/types';
import type { AgentKind } from '../../../session/agent-kind';
import { WorkflowStepGraphBranch } from './WorkflowStepGraphBranch';

type Props = {
  readonly workflow: Workflow;
  readonly runs: ReadonlyArray<Agent>;
  readonly childrenByParentId: ReadonlyMap<string, ReadonlyArray<Agent>>;
  readonly agentKindOverride: Readonly<Record<string, AgentKind>>;
  readonly agentModelOverride: Readonly<Record<string, string>>;
  readonly agentProviderOverride: Readonly<Record<string, ProviderId>>;
  readonly roleModels: RoleModelPreferences | null;
  readonly selectedAgentId: AgentId | null;
  readonly onSelect: (id: AgentId) => void;
};

export const WorkflowStepGraph = ({
  workflow,
  runs,
  childrenByParentId,
  agentKindOverride,
  agentModelOverride,
  agentProviderOverride,
  roleModels,
  selectedAgentId,
  onSelect,
}: Props) => {
  const stepById = new Map<string, Step>(workflow.steps.map((step) => [step.id, step]));
  const sortedRuns = [...runs].sort((first, second) => first.ordinal - second.ordinal);

  return (
    <div
      className="flex min-w-0 flex-col gap-1"
      aria-label="workflow steps"
      data-testid="workflow-step-graph"
    >
      {sortedRuns.map((run, index) => (
        <WorkflowStepGraphBranch
          key={run.id}
          run={run}
          marker={`${index + 1}`}
          depth={0}
          step={run.stepId == null ? null : (stepById.get(run.stepId) ?? null)}
          childrenByParentId={childrenByParentId}
          agentKindOverride={agentKindOverride}
          agentModelOverride={agentModelOverride}
          agentProviderOverride={agentProviderOverride}
          roleModels={roleModels}
          selectedAgentId={selectedAgentId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};
