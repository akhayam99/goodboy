import type { AgentId, ModelEffort, ProviderId, RoleModelPreferences } from '@goodboy/types';
import { inferAgentKindFromName, type AgentKind } from '../../../session/agent-kind';
import { railColumnX, type RailRow } from '../../../session/timeline/railGeometry';
import { TimelineRail } from '../../../session/components/SessionWorkspace/parts/TimelinePane/TimelineRail';
import { useExecutedAgentRouting } from '../../../../store';
import { resolveStepRouting } from '../../resolveStepRouting';
import { STEP_ROW_HEIGHT, type StepGraphRow } from './stepGraphRows';
import { WorkflowStepGraphNode } from './WorkflowStepGraphNode';
import { WorkflowStepRailMarker } from './WorkflowStepRailMarker';

type Props = {
  readonly row: StepGraphRow;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly agentKindOverride: Readonly<Record<string, AgentKind>>;
  readonly agentModelOverride: Readonly<Record<string, string>>;
  readonly agentProviderOverride: Readonly<Record<string, ProviderId>>;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: ModelEffort | null;
  readonly selectedAgentId: AgentId | null;
  readonly onSelect: (id: AgentId) => void;
};

export const WorkflowStepGraphRow = ({
  row,
  rail,
  railWidth,
  agentKindOverride,
  agentModelOverride,
  agentProviderOverride,
  roleModels,
  sessionProvider,
  sessionEffort,
  selectedAgentId,
  onSelect,
}: Props) => {
  const { run, step } = row;
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

  return (
    <div className="flex min-w-0 gap-1" style={{ height: STEP_ROW_HEIGHT }}>
      <span
        className="relative shrink-0"
        style={{ width: railWidth }}
        data-testid={`workflow-step-rail-${run.id}`}
      >
        <TimelineRail rail={rail} width={railWidth} />
        {rail.markerY == null ? null : (
          <span
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: railColumnX({ column: rail.markerColumn }), top: rail.markerY }}
            data-rail-column={rail.markerColumn}
          >
            <WorkflowStepRailMarker status={run.status} />
          </span>
        )}
      </span>
      <WorkflowStepGraphNode
        run={run}
        kind={kind}
        provider={executed?.provider ?? routing.provider}
        model={executed?.model ?? routing.model}
        plannedProvider={routing.provider}
        plannedModel={routing.model}
        marker={row.marker}
        childCount={row.childCount}
        doneChildCount={row.doneChildCount}
        isSelected={selectedAgentId === run.id}
        onSelect={() => onSelect(run.id)}
      />
    </div>
  );
};
