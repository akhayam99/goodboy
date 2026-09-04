import type {
  Agent,
  AgentId,
  ModelEffort,
  ProviderId,
  RoleModelPreferences,
  Step,
  Workflow,
} from '@goodboy/types';
import type { AgentKind } from '../../../session/agent-kind';
import { layoutBranchRail } from '../../../session/timeline/railGeometry';
import { STEP_ROW_HEIGHT, STEP_ROW_MARKER_Y, buildStepGraphRows } from './stepGraphRows';
import { WorkflowStepGraphRow } from './WorkflowStepGraphRow';

type Props = {
  readonly workflow: Workflow;
  readonly runs: ReadonlyArray<Agent>;
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

export const WorkflowStepGraph = ({
  workflow,
  runs,
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
  const stepById = new Map<string, Step>(workflow.steps.map((step) => [step.id, step]));
  const rows = buildStepGraphRows({ runs, childrenByParentId, stepById });
  const rail = layoutBranchRail({
    rows: rows.map((row) => ({
      id: row.run.id,
      depth: row.depth,
      height: STEP_ROW_HEIGHT,
      markerY: STEP_ROW_MARKER_Y,
      isStarted: row.run.status !== 'pending',
    })),
  });

  return (
    <div
      className="flex min-w-0 flex-col"
      aria-label="Workflow steps"
      data-testid="workflow-step-graph"
    >
      {rows.map((row, index) => {
        const railRow = rail.rows[index];
        if (railRow === undefined) {
          return null;
        }
        return (
          <WorkflowStepGraphRow
            key={row.run.id}
            row={row}
            rail={railRow}
            railWidth={rail.width}
            agentKindOverride={agentKindOverride}
            agentModelOverride={agentModelOverride}
            agentProviderOverride={agentProviderOverride}
            roleModels={roleModels}
            sessionProvider={sessionProvider}
            sessionEffort={sessionEffort}
            selectedAgentId={selectedAgentId}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
};
