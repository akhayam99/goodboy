import type { BranchCommit } from '@goodboy/types';
import { formatIntl } from '../../shared/utils/time/formatIntl';

type HistoryDay = {
  readonly key: string;
  readonly label: string;
  readonly commits: ReadonlyArray<BranchCommit>;
};

type Params = {
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly nowMs: number;
};

type DayKeyParams = {
  readonly date: Date;
};

const dayKey = ({ date }: DayKeyParams): string =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export const historyDaysOf = ({ commits, nowMs }: Params): ReadonlyArray<HistoryDay> => {
  const today = new Date(nowMs);
  const yesterday = new Date(nowMs);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayKey = dayKey({ date: today });
  const yesterdayKey = dayKey({ date: yesterday });
  const days: Array<{ key: string; label: string; commits: BranchCommit[] }> = [];
  for (const commit of commits) {
    const date = new Date(commit.timestamp * 1000);
    const key = dayKey({ date });
    const previous = days[days.length - 1];
    if (previous?.key === key) {
      previous.commits.push(commit);
      continue;
    }
    const label =
      key === todayKey
        ? 'Today'
        : key === yesterdayKey
          ? 'Yesterday'
          : formatIntl({
              at: date.getTime(),
              options: {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
              },
            });
    days.push({ key, label, commits: [commit] });
  }
  return days;
};
