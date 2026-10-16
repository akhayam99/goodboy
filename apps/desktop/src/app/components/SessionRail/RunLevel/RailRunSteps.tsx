import { Tooltip, WorkNode, cn } from '@goodboy/ui';
import type { Agent, Session, Workflow, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { agentKindPalette } from '../../../../features/session/agent-kind';
import { useRunTree } from '../../../../features/workflows/components/RunTree/useRunTree';
import type { PresetRunFocus } from '../../../../features/workflows/presetRunFocusOf';
import { rowStateNode } from '../../../../features/workTreeModel/rowStateCopy';
import { RAIL_BUTTON_IDLE, RAIL_NODE_BUTTON, RAIL_NODE_CURRENT } from '../../SideColumn/RailButton';

type Props = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly focus: PresetRunFocus;
  readonly onOpen: (agentId: Agent['id']) => void;
};

export const RailRunSteps = ({ session, run, workflow, focus, onOpen }: Props) => {
  const agentKindOverride = useAppStore((state) => state.agentKindOverride);
  const tree = useRunTree({ session, run, workflow, agentKindOverride });
  const steps = (tree?.stream.items ?? []).flatMap((item) =>
    item.kind === 'row' && item.entry.kind === 'agent' && item.entry.agent.parentAgentId == null
      ? [{ state: item.rowState, entry: item.entry }]
      : [],
  );
  return (
    <>
      {steps.map(({ state, entry }, index) => {
        const node = rowStateNode({ state });
        const role = agentKindPalette({ kind: entry.agentKind }).label;
        const label = `Step ${index + 1}, ${role}, ${node.label}`;
        const isCurrent = focus.agentId === entry.agent.id;
        return (
          <Tooltip key={entry.agent.id} content={label} side="right">
            <button
              type="button"
              data-rail-page={`run-step-${entry.agent.id}`}
              aria-label={label}
              aria-current={isCurrent ? 'page' : undefined}
              onClick={() => onOpen(entry.agent.id)}
              className={cn(RAIL_NODE_BUTTON, isCurrent ? RAIL_NODE_CURRENT : RAIL_BUTTON_IDLE)}
            >
              <WorkNode state={node.state} label={label} mark={{ kind: 'dot' }} />
            </button>
          </Tooltip>
        );
      })}
    </>
  );
};
