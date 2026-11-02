import { StepMark } from './StepMark';

type Props = {
  readonly titles: ReadonlyArray<string>;
};

type JoinParams = {
  readonly titles: ReadonlyArray<string>;
};

const joinTitles = ({ titles }: JoinParams): string => {
  const last = titles[titles.length - 1];
  if (titles.length < 2 || last === undefined) {
    return titles.join('');
  }
  return `${titles.slice(0, -1).join(', ')} and ${last}`;
};

export const DoneLine = ({ titles }: Props) => (
  <li
    data-state="done"
    className="flex w-full items-center gap-2 px-2 py-1 text-row text-muted-foreground"
  >
    <StepMark isDone />
    <span className="min-w-0 truncate">{`${joinTitles({ titles })} done`}</span>
  </li>
);
