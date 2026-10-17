import type { BaseDivergence } from '@goodboy/types';

type Entry = {
  readonly report: BaseDivergence | undefined;
};

type Params<T extends Entry> = {
  readonly entries: ReadonlyArray<T>;
};

export type RepoGroups<T extends Entry> = {
  readonly attention: ReadonlyArray<T>;
  readonly quiet: ReadonlyArray<T>;
  readonly quietLine: string | null;
};

const ATTENTION_RANK: Readonly<Record<BaseDivergence['state'], number | null>> = {
  behind: 0,
  diverged: 1,
  missing: 2,
  'fetch-failed': 3,
  'up-to-date': null,
  ahead: null,
  'no-upstream': null,
  'no-base': null,
};

type RankParams = {
  readonly report: BaseDivergence | undefined;
};

const rankOf = ({ report }: RankParams): number | null =>
  report === undefined ? null : ATTENTION_RANK[report.state];

type CountParams = {
  readonly count: number;
};

const reposWord = ({ count }: CountParams): string => (count === 1 ? '1 repo' : `${count} repos`);

type LineParams<T extends Entry> = {
  readonly quiet: ReadonlyArray<T>;
};

const quietLineOf = <T extends Entry>({ quiet }: LineParams<T>): string | null => {
  if (quiet.length === 0) {
    return null;
  }
  const pending = quiet.filter((entry) => entry.report === undefined).length;
  if (pending === quiet.length) {
    return `Checking ${reposWord({ count: pending })}…`;
  }
  const settled = quiet.length - pending;
  const isAllUpToDate = quiet.every(
    (entry) => entry.report === undefined || entry.report.state === 'up-to-date',
  );
  const settledWord = isAllUpToDate
    ? `${settled} up to date`
    : `${reposWord({ count: settled })} with nothing to pull`;
  return pending === 0 ? settledWord : `${settledWord} · ${pending} checking`;
};

export const repoGroupsOf = <T extends Entry>({ entries }: Params<T>): RepoGroups<T> => {
  const ranked = entries.flatMap((entry, index) => {
    const rank = rankOf({ report: entry.report });
    return rank === null ? [] : [{ entry, rank, index }];
  });
  const attention = [...ranked]
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(({ entry }) => entry);
  const quiet = entries.filter((entry) => rankOf({ report: entry.report }) === null);
  return { attention, quiet, quietLine: quietLineOf({ quiet }) };
};
