import { joinFacts } from '../../../shared/utils/joinFacts';
import { formatClock } from '../../../shared/utils/time/formatClock';
import { formatDuration } from '../../../shared/utils/time/formatDuration';
import type { ChipView } from './callChipTypes';

const MINUTE = 60_000;
const SECOND = 1_000;
const NAMED_PEOPLE = 2;
const NOTHING_WAITS = 'Nothing waits for you. Agents keep working during the call.';

export type ChipLines = Readonly<{
  title: string;
  sub: string;
  clock: string | null;
  isStarted: boolean;
  heading: string | null;
}>;

type Params = {
  readonly view: ChipView;
  readonly now: number;
};

type UntilParams = {
  readonly start: number;
  readonly now: number;
};

type PeopleParams = {
  readonly people: ReadonlyArray<string>;
};

type CountParams = {
  readonly count: number;
  readonly one: string;
  readonly many: string;
};

const untilText = ({ start, now }: UntilParams): string | null => {
  const left = start - now;
  if (left < SECOND) {
    return null;
  }
  const step = left < MINUTE ? SECOND : MINUTE;
  const rounded = Math.ceil(left / step) * step;
  const duration = formatDuration({ durationMs: rounded });
  return duration === null ? null : `in ${duration}`;
};

type NameParams = {
  readonly name: string;
};

const firstNameOf = ({ name }: NameParams): string => name.trim().split(' ')[0] ?? name;

const peopleText = ({ people }: PeopleParams): string | null => {
  if (people.length === 0) {
    return null;
  }
  const named = people.slice(0, NAMED_PEOPLE).map((name) => firstNameOf({ name }));
  const rest = people.length - named.length;
  if (rest === 0) {
    return named.join(', ');
  }
  return `${named.join(', ')} and ${rest} more`;
};

const countText = ({ count, one, many }: CountParams): string | null => {
  if (count === 0) {
    return null;
  }
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
};

const NO_CLOCK: Pick<ChipLines, 'clock' | 'isStarted' | 'heading'> = {
  clock: null,
  isStarted: false,
  heading: null,
};

export const chipLinesOf = ({ view, now }: Params): ChipLines => {
  if (view.kind === 'soon') {
    const count = view.rows.length;
    return {
      ...NO_CLOCK,
      title: view.title,
      sub: joinFacts({
        facts: [formatClock({ at: view.start }), untilText({ start: view.start, now }), view.host],
      }),
      heading:
        count === 0
          ? NOTHING_WAITS
          : joinFacts({ facts: ['Before the call', `${count} need you`] }),
    };
  }
  if (view.kind === 'countdown') {
    const until = untilText({ start: view.start, now });
    return {
      ...NO_CLOCK,
      title: view.title,
      sub: joinFacts({ facts: [view.host, peopleText({ people: view.people })] }),
      clock: until ?? 'Started',
      isStarted: until === null,
    };
  }
  if (view.kind === 'check-link') {
    return {
      ...NO_CLOCK,
      title: `Open ${view.host}?`,
      sub: 'This link is not from a call app Goodboy knows.',
    };
  }
  if (view.kind === 'snoozed') {
    const verb = view.start > now ? 'starts' : 'started';
    return {
      ...NO_CLOCK,
      title: `Snoozed until ${formatClock({ at: view.until })}`,
      sub: `The call ${verb} at ${formatClock({ at: view.start })}.`,
    };
  }
  if (view.kind === 'in-call') {
    return {
      ...NO_CLOCK,
      title: joinFacts({ facts: ['In call', view.title] }),
      sub: joinFacts({
        facts: [
          `Goodboy is quiet until ${formatClock({ at: view.end })}`,
          countText({ count: view.heldCount, one: 'notice waits', many: 'notices wait' }),
        ],
      }),
      clock: formatDuration({ durationMs: now - view.joinedAt }),
    };
  }
  return {
    ...NO_CLOCK,
    title: 'While you were in the call',
    sub: joinFacts({
      facts: [
        `${formatClock({ at: view.start })} to ${formatClock({ at: view.end })}`,
        formatDuration({ durationMs: view.end - view.start }),
        countText({ count: view.rows.length, one: 'thing happened', many: 'things happened' }),
      ],
    }),
  };
};
