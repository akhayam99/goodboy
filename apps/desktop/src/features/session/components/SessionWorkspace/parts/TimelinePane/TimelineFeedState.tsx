import { buttonClasses, cn, type ActivityRowTone } from '@goodboy/ui';
import { actionButtonLookOf } from '../../../../../actions/actionButtonLookOf';
import type { RowState } from '../../../../../workTreeModel/rowState';
import { statePresentationOf } from '../../../../../workTreeModel/statePresentation';
import { TimelineRowStateWord } from './TimelineRowStateWord';
import { timelineRowTone } from './timelineRowTone';

type Props = {
  readonly state: RowState;
};

const ANSWER = 'Answer';

const STATE_TONE: Record<ActivityRowTone, string> = {
  quiet: 'text-faint-foreground',
  live: 'text-info',
  attention: 'text-warning',
  failed: 'text-danger',
  pending: 'text-faint-foreground',
};

export const TimelineFeedState = ({ state }: Props) => {
  const shown = statePresentationOf({ state });
  if (state.ask?.kind === 'answer') {
    const look = actionButtonLookOf({ verb: ANSWER, variant: 'secondary' });
    return (
      <span data-testid="timeline-row-action" className="flex items-center">
        <span
          aria-hidden
          className={buttonClasses({ variant: look.variant, size: 'xs', intent: look.intent })}
        >
          {ANSWER}
        </span>
        {shown === null ? null : <span className="sr-only">{shown.word}</span>}
      </span>
    );
  }
  if (shown === null) {
    return null;
  }
  const tone = timelineRowTone({ state });
  return (
    <span
      data-testid="timeline-row-state"
      data-state-tone={tone}
      className={cn(
        'flex min-w-0 items-center justify-end',
        state.reason?.kind === 'notFinished' ? 'text-warning' : STATE_TONE[tone],
      )}
    >
      <TimelineRowStateWord shown={shown} />
    </span>
  );
};
