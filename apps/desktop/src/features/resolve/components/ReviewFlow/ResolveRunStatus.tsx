import type { ReactNode } from 'react';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { TailLine } from '../../../live-state/TailLine';
import { TAIL_ACTION } from '../../../live-state/tailAction';
import type { TailAction, TailActionId, TailFacts } from '../../../live-state/tailFacts';
import type { LaneStatus } from '../../laneStatus';
import { fixRunTitle, type FixRun } from '../../fixRun';
import { StopRunButton } from './StopRunButton';

type Props = {
  readonly run: FixRun;
  readonly onOpenTranscript: (() => void) | null;
  readonly onStop: () => void;
  readonly lane?: LaneStatus | null;
  readonly actions?: ReactNode;
  readonly noun?: 'comment' | 'note';
};

type FactsParams = Pick<Props, 'run' | 'onOpenTranscript'> & {
  readonly lane: LaneStatus | null;
  readonly noun: 'comment' | 'note';
};

const startedAtOf = ({ run }: Pick<FactsParams, 'run'>): IsoDateTime | null =>
  run.attempt.startedAt === null
    ? null
    : brandId<IsoDateTime>({ value: new Date(run.attempt.startedAt).toISOString() });

const factsOf = ({ run, lane, noun, onOpenTranscript }: FactsParams): TailFacts => {
  const isLive = run.isLive || lane !== null;
  const actions: ReadonlyArray<TailAction> =
    onOpenTranscript === null ? [] : [TAIL_ACTION.viewTranscript];
  return {
    state: isLive ? 'working' : run.tally.pushFailed > 0 ? 'failed' : 'idle',
    phrase: lane === null ? fixRunTitle({ run, noun }) : lane.line,
    startedAt: isLive ? startedAtOf({ run }) : null,
    actions,
  };
};

export const ResolveRunStatus = ({
  run,
  onOpenTranscript,
  onStop,
  lane = null,
  actions = null,
  noun = 'comment',
}: Props) => {
  const onAction = (id: TailActionId): void => {
    if (id === 'viewTranscript') {
      onOpenTranscript?.();
    }
  };
  const isLive = run.isLive || lane !== null;
  return (
    <section aria-label="Fix run" data-testid="resolve-run-status" className="min-w-0">
      <TailLine
        facts={factsOf({ run, lane, noun, onOpenTranscript })}
        onAction={onAction}
        verbs={
          actions === null && !isLive ? null : (
            <>
              {actions}
              {isLive ? <StopRunButton onStop={onStop} /> : null}
            </>
          )
        }
      />
    </section>
  );
};
