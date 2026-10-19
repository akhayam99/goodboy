import { useContext, type ReactNode } from 'react';
import { ROW_INTERACTIVE, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { sessionPlace, useAppStore } from '../../../../store';
import type { RowPhase } from '../../../workTreeModel/rowState';
import { WorkTimeContext } from '../../../workTreeModel/workTimeSource';
import { runWorkTime } from '../../timeline/runWorkTime';
import { LiveChildLine } from './LiveChildLine';
import type { LiveGroupState, LiveRunGroup } from './liveGroupsOf';
import { runPositionOf } from './runPositionOf';
import { StepMeter } from './StepMeter';
import { stepMeterLabelOf } from './stepMeterLabelOf';

type Props = {
  readonly sessionId: SessionId;
  readonly group: LiveRunGroup;
  readonly chip?: ReactNode;
};

const PHASE_OF_STATE: Record<LiveGroupState, RowPhase> = {
  stuck: 'failed',
  waiting: 'waiting',
  working: 'running',
  deciding: 'running',
};

type TimeParams = {
  readonly label: string | null;
};

const timeTextOf = ({ label }: TimeParams): string | null => {
  if (label === null || label === '') {
    return null;
  }
  return label.endsWith(' left') ? label : `${label} in`;
};

export const LiveRunBlock = ({ sessionId, group, chip }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const source = useContext(WorkTimeContext);
  const time =
    source === null
      ? null
      : runWorkTime({
          entry: group.entry,
          phase: PHASE_OF_STATE[group.state],
          source,
          roleModels: null,
          sessionProvider: null,
          sessionEffort: null,
        });
  const position = runPositionOf({ group });
  const detail = [
    position === null || group.currentStep === null
      ? 'Not started'
      : `${position}, ${group.currentStep.title}`,
    timeTextOf({ label: time?.label ?? null }),
  ]
    .filter((part) => part !== null)
    .join(' · ');
  const isOrchestrated = group.kind === 'orchestrated';
  const open = () =>
    navigate({
      to: isOrchestrated
        ? sessionPlace({ sessionId, lens: 'orchestrated' })
        : sessionPlace({
            sessionId,
            lens: 'workflows',
            target: { kind: 'run', runId: group.entry.run.id },
          }),
    });
  return (
    <section
      aria-label={group.title}
      data-live-group={group.kind}
      data-state={group.state}
      className="flex min-w-0 flex-col gap-1"
    >
      <button
        type="button"
        aria-label={`Open ${group.title}`}
        onClick={open}
        className={cn(
          'flex min-w-0 flex-col gap-0.5 rounded-md px-1 py-1 text-left',
          ROW_INTERACTIVE,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-label text-foreground">{group.title}</span>
          {isOrchestrated || group.stepStates.length === 0 ? null : (
            <StepMeter states={group.stepStates} label={stepMeterLabelOf({ group })} />
          )}
          {chip}
        </span>
        <span className="min-w-0 truncate text-meta text-muted-foreground">{detail}</span>
        {isOrchestrated && group.doneCount > 0 ? (
          <span className="text-meta text-faint-foreground">
            {group.doneCount === 1 ? '1 step done' : `${group.doneCount} steps done`}
          </span>
        ) : null}
      </button>
      {group.children.length === 0 ? null : (
        <ul aria-label="Running now" className="flex min-w-0 list-none flex-col gap-0.5">
          {group.children.map((child) => (
            <LiveChildLine key={child.agentId} child={child} />
          ))}
        </ul>
      )}
      {group.isDeciding ? (
        <div className="flex min-w-0 gap-1">
          <span aria-hidden className="w-6 shrink-0" />
          <p
            data-next-step-pending=""
            className="min-w-0 flex-1 rounded-md border border-dashed border-border px-2 py-1 text-meta text-muted-foreground"
          >
            Next step, not decided yet
          </p>
        </div>
      ) : null}
    </section>
  );
};
