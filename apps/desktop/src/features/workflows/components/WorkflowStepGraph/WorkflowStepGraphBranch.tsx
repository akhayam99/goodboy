import type {
  Agent,
  AgentId,
  ModelEffort,
  ProviderId,
  RoleModelPreferences,
  Step,
} from '@goodboy/types';
import { inferAgentKindFromName, type AgentKind } from '../../../session/agent-kind';
import { useExecutedAgentRouting } from '../../../../store';
import { resolveStepRouting } from '../../resolveStepRouting';
import { WorkflowStepGraphNode } from './WorkflowStepGraphNode';

const MAX_DEPTH = 4;

type Props = {
  readonly run: Agent;
  readonly marker: string;
  readonly depth: number;
  readonly step: Step | null;
  readonly childrenByParentId: ReadonlyMap<string, ReadonlyArray<Agent>>;
  readonly agentKindOverride: Readonly<Record<string, AgentKind>>;
  readonly agentModelOverride: Readonly<Record<string, string>>;
  readonly agentProviderOverride: Readonly<Record<string, ProviderId>>;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: ModelEffort | null;
  readonly selectedAgentId: AgentId | null;
  readonly onSelect: (id: AgentId) => void;
};

export const WorkflowStepGraphBranch = ({
  run,
  marker,
  depth,
  step,
  childrenByParentId,
  agentKindOverride,
  agentModelOverride,
  agentProviderOverride,
  roleModels,
  sessionProvider,
  sessionEffort,
  selectedAgentId,
  onSelect,
}: Props) => {
  const children = childrenByParentId.get(run.id) ?? [];
  const kind = agentKindOverride[run.id] ?? inferAgentKindFromName(run.name);
  const routing = resolveStepRouting({
    step,
    kind,
    roleModels,
    agentModel: agentModelOverride[run.id] ?? run.modelOverride,
    agentProvider: agentProviderOverride[run.id] ?? run.providerOverride,
    sessionProvider,
    sessionEffort,
  });
  const executed = useExecutedAgentRouting({ agent: run });
  const doneChildCount = children.filter(
    (child) => child.status === 'completed' || child.status === 'skipped',
  ).length;
  const showBranch = children.length > 0 && depth < MAX_DEPTH;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <WorkflowStepGraphNode
        run={run}
        kind={kind}
        provider={executed?.provider ?? routing.provider}
        model={executed?.model ?? routing.model}
        plannedProvider={routing.provider}
        plannedModel={routing.model}
        marker={marker}
        childCount={showBranch ? children.length : 0}
        doneChildCount={doneChildCount}
        isSelected={selectedAgentId === run.id}
        onSelect={() => onSelect(run.id)}
      />
      {showBranch ? (
        <div className="flex min-w-0 pl-8">
          <div className="flex min-w-0 flex-1 flex-col gap-1 border-l border-border-soft/60 pl-2">
            {[...children]
              .sort((first, second) => first.ordinal - second.ordinal)
              .map((child, index) => (
                <WorkflowStepGraphBranch
                  key={child.id}
                  run={child}
                  marker={`${marker}.${index + 1}`}
                  depth={depth + 1}
                  step={null}
                  childrenByParentId={childrenByParentId}
                  agentKindOverride={agentKindOverride}
                  agentModelOverride={agentModelOverride}
                  agentProviderOverride={agentProviderOverride}
                  roleModels={roleModels}
                  sessionProvider={sessionProvider}
                  sessionEffort={sessionEffort}
                  selectedAgentId={selectedAgentId}
                  onSelect={onSelect}
                />
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
