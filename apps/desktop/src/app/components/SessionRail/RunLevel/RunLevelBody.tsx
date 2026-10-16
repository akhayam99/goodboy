import { Plus } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { ScrollFade, SelectableRow, cn } from '@goodboy/ui';
import type { AgentId, Session, Workflow, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { NAMES } from '../../../../shared/names';
import type { AgentKind } from '../../../../features/session/agent-kind';
import { RunTree } from '../../../../features/workflows/components/RunTree';
import { useRunTree } from '../../../../features/workflows/components/RunTree/useRunTree';
import { leaveRunLevel } from '../../../../features/workflows/leaveRunLevel';
import { requestRunAddStep } from '../../../../features/workflows/requestRunAddStep';
import { runPlace } from '../../../../features/workflows/runPlace';
import { LevelBackRow } from '../LevelBackRow';
import { RunIdentityRow } from './RunIdentityRow';
import { RunLevelFoot } from './RunLevelFoot';

type Props = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly selectedAgentId: AgentId | null;
};

const ENTRY_CLASS = 'h-7 min-w-0 flex-1 items-center gap-2 px-2 text-ui';

const RAIL_ROW_HEIGHT = 28;

export const RunLevelBody = ({ session, run, workflow, selectedAgentId }: Props) => {
  const sessionId = session.id;
  const navigate = useAppStore((state) => state.navigate);
  const roleModels = useSessionRoleModels({ sessionId });
  const agentKindOverride = useAppStore(
    useShallow((state) => {
      const overrides: Record<string, AgentKind> = {};
      for (const agent of state.sessionPhaseRuns[sessionId] ?? []) {
        const kind = state.agentKindOverride[agent.id];
        if (kind !== undefined) {
          overrides[agent.id] = kind;
        }
      }
      return overrides;
    }),
  );
  const tree = useRunTree({
    session,
    run,
    workflow,
    agentKindOverride,
    rowHeight: RAIL_ROW_HEIGHT,
  });
  const gutter = tree?.rail.width ?? 0;
  const isOverview = selectedAgentId === null;
  const isArchived = run.discardedAt != null;
  const open = (agentId: AgentId | null) =>
    navigate({ to: runPlace({ sessionId, runId: run.id, agentId }) });

  return (
    <div data-run-level={run.id} className="flex min-h-0 flex-1 flex-col gap-1">
      <div className="flex shrink-0 flex-col px-2">
        <LevelBackRow label={NAMES.runs} onBack={() => leaveRunLevel({ sessionId })} />
        <RunIdentityRow session={session} run={run} workflow={workflow} />
      </div>
      <ScrollFade className="min-h-0 flex-1">
        <div className="flex flex-col px-2 pb-2">
          <div data-run-overview-row="" className="flex min-w-0">
            <span aria-hidden className="shrink-0" style={{ width: gutter }} />
            <SelectableRow
              selected={isOverview}
              ariaCurrent={isOverview ? 'page' : undefined}
              onClick={() => open(null)}
              className={ENTRY_CLASS}
            >
              <span aria-hidden className="w-6 shrink-0" />
              <span className="inline-flex size-4.5 shrink-0 items-center justify-center">
                <CONCEPT_ICONS.timeline size={ICON_SIZE.row} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate">{NAMES.overview}</span>
            </SelectableRow>
          </div>
          <RunTree
            density="rail"
            sessionId={sessionId}
            runId={run.id}
            tree={tree}
            routing={{
              stepById: new Map(workflow.steps.map((step) => [step.id, step])),
              roleModels,
              sessionProvider: session.providerPreference?.defaultProvider ?? null,
              sessionEffort: session.effort ?? null,
              run,
            }}
            selectedAgentId={selectedAgentId}
            highlightedStepId={null}
            onHighlight={() => undefined}
            onSelect={(agentId) => open(agentId)}
            onAnswer={() => undefined}
          />
          {isArchived ? null : (
            <div data-run-add-step="" className="flex min-w-0">
              <span aria-hidden className="shrink-0" style={{ width: gutter }} />
              <SelectableRow
                selected={false}
                onClick={() => {
                  open(null);
                  requestRunAddStep({ runId: run.id });
                }}
                className={cn(ENTRY_CLASS, 'text-muted-foreground')}
              >
                <span aria-hidden className="w-6 shrink-0" />
                <span className="inline-flex size-4.5 shrink-0 items-center justify-center">
                  <Plus size={ICON_SIZE.row} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate">Add step</span>
              </SelectableRow>
            </div>
          )}
        </div>
      </ScrollFade>
      <RunLevelFoot sessionId={sessionId} run={run} />
    </div>
  );
};
