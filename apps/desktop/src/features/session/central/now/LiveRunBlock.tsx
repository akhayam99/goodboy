import { useContext } from 'react';
import type { MeasuredTurnSpan, Session, SessionId } from '@goodboy/types';
import { agentPlace, sessionPlace, useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/utils/names';
import type { RowPhase } from '../../../workTreeModel/rowState';
import { WorkTimeContext } from '../../../workTreeModel/workTimeSource';
import { runWorkTime } from '../../timeline/runWorkTime';
import { agentModelLineOf } from './agentModelLineOf';
import { LiveChildren } from './LiveChildren';
import { LiveGlyph } from './LiveGlyph';
import type { LiveGroupState, LiveRunGroup } from './liveGroupsOf';
import { LiveRow } from './LiveRow';
import { LiveRunEnd } from './LiveRunEnd';
import { LiveStateWord } from './LiveStateWord';
import { liveStatusOf } from './liveStatusOf';
import { LIVE_TONE } from './liveTone';
import { runStepCardOf } from './runStepCardOf';
import { StepMeter } from './StepMeter';
import { stepMeterLabelOf } from './stepMeterLabelOf';

type Props = {
  readonly sessionId: SessionId;
  readonly session: Session | null;
  readonly group: LiveRunGroup;
  readonly where: string | null;
  readonly isLead: boolean;
};

const PHASE_OF_STATE: Record<LiveGroupState, RowPhase> = {
  stuck: 'failed',
  waiting: 'waiting',
  working: 'running',
  deciding: 'running',
};

const NO_SPANS: ReadonlyArray<MeasuredTurnSpan> = [];

type TimeParams = {
  readonly label: string | null;
};

type ReasonParams = {
  readonly group: LiveRunGroup;
};

const runStatusDetailOf = ({ group }: ReasonParams): string | null => {
  if (group.state === 'waiting' && group.waitingStepNumber !== null) {
    return `Waits for your go on step ${group.waitingStepNumber}`;
  }
  if (group.state === 'stuck' && group.failedStep !== null) {
    return `Step ${group.failedStep.number} failed: ${group.failedStep.title}`;
  }
  return null;
};

const timeTextOf = ({ label }: TimeParams): string | null =>
  label === null || label === '' ? null : label;

export const LiveRunBlock = ({ sessionId, session, group, where, isLead }: Props) => {
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
  const timeText = timeTextOf({ label: time?.label ?? null });
  const isOrchestrated = group.kind === 'orchestrated';
  const Glyph = isOrchestrated ? CONCEPT_ICONS.orchestrator : CONCEPT_ICONS.workflows;
  const runningAgent =
    group.entry.children.flatMap((child) =>
      child.kind === 'agent' && child.agent.status === 'running' ? [child.agent] : [],
    )[0] ?? null;
  const model =
    runningAgent === null
      ? null
      : agentModelLineOf({ agent: runningAgent, spans: source?.spans ?? NO_SPANS, isLive: true });
  const card = runStepCardOf({ group, model, time: timeText });
  const openRun = () =>
    navigate({
      to: sessionPlace({
        sessionId,
        lens: 'workflows',
        target: { kind: 'run', runId: group.entry.run.id },
      }),
    });
  const openStep = () => {
    if (runningAgent === null) {
      openRun();
      return;
    }
    navigate({ to: agentPlace({ sessionId, agentId: runningAgent.id }) });
  };
  const stateSpec = LIVE_TONE.state[group.state];
  const status = liveStatusOf({ word: stateSpec.word, detail: runStatusDetailOf({ group }) });
  const stateWord = <LiveStateWord tone={stateSpec.tone} word={status.word} />;
  return (
    <section
      aria-label={`${NAMES.runKind.workflow}: ${group.title}`}
      data-live-group={group.kind}
      data-state={group.state}
      className="flex min-w-0 flex-col"
    >
      <LiveRow
        glyph={<LiveGlyph icon={Glyph} colorClass="text-muted-foreground" />}
        kindWord={NAMES.runKind.workflow}
        title={group.title}
        reason={status.reason}
        openLabel={`Open ${group.title}`}
        onOpen={openRun}
        meter={
          group.steps.length === 0 ? null : (
            <StepMeter
              steps={group.steps}
              startedCount={group.counts.started}
              label={stepMeterLabelOf({ group })}
              card={card}
              onOpen={openStep}
            />
          )
        }
        where={where}
        end={
          session === null ? (
            stateWord
          ) : (
            <LiveRunEnd session={session} group={group} fallback={stateWord} isLead={isLead} />
          )
        }
        time={
          timeText === null ? null : (
            <span className="text-meta tabular-nums text-faint-foreground">{timeText}</span>
          )
        }
      />
      <LiveChildren sessionId={sessionId} parentTitle={group.title} items={group.children} />
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
