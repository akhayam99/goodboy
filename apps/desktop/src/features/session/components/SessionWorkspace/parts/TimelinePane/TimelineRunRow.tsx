import { Chip } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import { runKindLabel } from '../../../../timeline/runKindLabel';
import type { WorkflowAdvanceState } from '../../../../../workflows/advanceGate';
import { TimelineRow, type TimelineRowContinuation } from './TimelineRow';
import { TimelineStatusMarker, type TimelineMarkerState } from './TimelineStatusMarker';

type AdvanceParams = {
  readonly agentId: string;
};

type Props = {
  readonly entry: TimelineRunEntry;
  readonly sessionId: SessionId;
  readonly timeLabel: string | null;
  readonly advanceState: WorkflowAdvanceState;
  readonly hasStalledStep: boolean;
  readonly isExpanded: boolean;
  readonly onToggle: () => void;
  readonly onAdvance: (params: AdvanceParams) => void;
};

type StatusParams = {
  readonly agents: ReadonlyArray<Agent>;
};

const runStatusOf = ({ agents }: StatusParams): TimelineMarkerState => {
  if (agents.some((agent) => agent.status === 'running')) {
    return 'running';
  }
  if (agents.some((agent) => agent.status === 'failed')) {
    return 'failed';
  }
  if (agents.length === 0) {
    return 'pending';
  }
  if (agents.every((agent) => agent.status === 'completed' || agent.status === 'skipped')) {
    return 'completed';
  }
  return 'waiting';
};

export const TimelineRunRow = ({
  entry,
  sessionId,
  timeLabel,
  advanceState,
  hasStalledStep,
  isExpanded,
  onToggle,
  onAdvance,
}: Props) => {
  const setFocusedWorkflowRun = useAppStore((s) => s.setFocusedWorkflowRun);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const stepAgents = entry.children.flatMap((child) =>
    child.kind === 'agent' ? [child.agent] : [],
  );
  const status = runStatusOf({ agents: stepAgents });
  const openRun = () => {
    setFocusedWorkflowRun(sessionId, entry.run.id);
    setActiveLens(sessionId, 'workflows');
  };

  const continuation = ((): TimelineRowContinuation | null => {
    if (hasStalledStep) {
      return { label: 'Restart the step', onContinue: openRun };
    }
    if (advanceState.kind === 'blocked' && advanceState.reason === 'questions') {
      return { label: 'Answer', onContinue: () => setActiveLens(sessionId, 'questions') };
    }
    if (advanceState.kind !== 'ready') {
      return null;
    }
    const pending = stepAgents.find(
      (agent) => agent.stepId === advanceState.step.id && agent.status === 'pending',
    );
    if (pending == null) {
      return null;
    }
    return {
      label: `Start ${advanceState.step.name}`,
      onContinue: () => onAdvance({ agentId: pending.id }),
    };
  })();

  return (
    <TimelineRow
      timeLabel={timeLabel}
      indent={0}
      identity={entry.identity}
      needsUser={hasStalledStep || advanceState.kind === 'blocked'}
      marker={<TimelineStatusMarker state={hasStalledStep ? 'waiting' : status} />}
      chip={
        <Chip
          tone="accent"
          label={runKindLabel({ workflow: entry.workflow })}
          shape="badge"
          size="xs"
          width="md"
          className="shrink-0"
        />
      }
      label={
        <span className="min-w-0 truncate text-sm font-medium text-foreground">
          {entry.workflow.name}
        </span>
      }
      navigation={{ label: 'Open run', onNavigate: openRun }}
      continuation={continuation}
      isExpanded={isExpanded}
      onToggle={entry.children.length > 0 ? onToggle : undefined}
      disclosureLabel={`${isExpanded ? 'Collapse' : 'Expand'} ${entry.workflow.name}`}
    />
  );
};
