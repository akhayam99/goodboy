import { StateDot, type DotState } from '@goodboy/ui';
import type {
  SeriesPartState,
  SeriesStrip as SeriesStripModel,
} from '../../../../../store/slices/pr-series/seriesStripsOf';

type Props = {
  readonly strip: SeriesStripModel;
};

type PartDotParams = {
  readonly state: SeriesPartState;
  readonly isCurrent: boolean;
};

const dotOf = ({ state, isCurrent }: PartDotParams): DotState => {
  if (state === 'merged') {
    return 'done';
  }
  if (state === 'planned') {
    return 'stopped';
  }
  return isCurrent ? 'running' : 'idle';
};

const WORD: Readonly<Record<SeriesPartState, string>> = {
  merged: 'merged',
  closed: 'closed',
  open: 'in progress',
  planned: 'planned',
};

type HeadlineParams = {
  readonly strip: SeriesStripModel;
};

const seriesHeadlineOf = ({ strip }: HeadlineParams): string =>
  strip.current === null
    ? `Series ${strip.name}, all ${strip.total} parts done`
    : `Series ${strip.name}, part ${strip.current} of ${strip.total}`;

export const SeriesStrip = ({ strip }: Props) => {
  const unplanned = strip.parts.filter((part) => part.state === 'planned');
  return (
    <div
      role="group"
      aria-label={seriesHeadlineOf({ strip })}
      data-series-strip={strip.id}
      className="flex min-w-0 flex-col gap-1 rounded-md bg-hover px-3 py-2"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex shrink-0 items-center gap-2">
          {strip.parts.map((part) => (
            <StateDot
              key={part.ordinal}
              state={dotOf({ state: part.state, isCurrent: part.ordinal === strip.current })}
              label={`Part ${part.ordinal} ${WORD[part.state]}`}
            />
          ))}
        </span>
        <span className="min-w-0 truncate text-ui text-foreground">
          {seriesHeadlineOf({ strip })}
        </span>
      </div>
      {unplanned.map((part) => (
        <span key={part.ordinal} className="truncate pl-1 text-ui text-faint-foreground">
          {`Part ${part.ordinal} of ${strip.total} is planned, no branch yet`}
        </span>
      ))}
    </div>
  );
};
