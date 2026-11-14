import { NO_BRANCH_KEY } from '../../../branchGroupsOf';
import { branchHeadLabelOf } from '../../../branchHeadOf';
import {
  questionRowTitle,
  type QuestionBranchGroup,
  type QuestionGroups,
  type QuestionRow,
} from './questionsLensModel';

export type QuestionFilter =
  | { readonly kind: 'all' }
  | { readonly kind: 'blocking' }
  | { readonly kind: 'branch'; readonly key: string };

export const ALL_QUESTIONS_FILTER: QuestionFilter = { kind: 'all' };

export type QuestionFilterChip = {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly filter: QuestionFilter;
};

type ChipsParams = {
  readonly groups: QuestionGroups;
  readonly branchGroups: ReadonlyArray<QuestionBranchGroup>;
};

type RowParams = {
  readonly row: QuestionRow;
};

const isBlockingRow = ({ row }: RowParams): boolean =>
  row.kind === 'waiting' && row.question.isBlocking;

export const questionFilterChipsOf = ({
  groups,
  branchGroups,
}: ChipsParams): ReadonlyArray<QuestionFilterChip> => {
  const branches = branchGroups
    .filter((group) => group.key !== NO_BRANCH_KEY && group.waiting.length > 0)
    .map((group): QuestionFilterChip => ({
      id: `branch:${group.key}`,
      label: branchHeadLabelOf({ head: group.head }),
      count: group.waiting.length,
      filter: { kind: 'branch', key: group.key },
    }));
  return [
    { id: 'all', label: 'All open', count: groups.waiting.length, filter: ALL_QUESTIONS_FILTER },
    {
      id: 'blocking',
      label: 'Blocking',
      count: groups.waiting.filter((row) => isBlockingRow({ row })).length,
      filter: { kind: 'blocking' },
    },
    ...branches,
  ];
};

type FilterParams = {
  readonly filter: QuestionFilter;
  readonly groups: QuestionGroups;
  readonly branchGroups: ReadonlyArray<QuestionBranchGroup>;
};

type Filtered = {
  readonly groups: QuestionGroups;
  readonly branchGroups: ReadonlyArray<QuestionBranchGroup>;
};

export const filterOpenQuestions = ({ filter, groups, branchGroups }: FilterParams): Filtered => {
  if (filter.kind === 'all') {
    return { groups, branchGroups };
  }
  if (filter.kind === 'blocking') {
    return {
      groups: { ...groups, waiting: groups.waiting.filter((row) => isBlockingRow({ row })) },
      branchGroups: branchGroups.map((group) => ({
        ...group,
        waiting: group.waiting.filter((item) => isBlockingRow({ row: item.row })),
      })),
    };
  }
  const kept = branchGroups.filter((group) => group.key === filter.key);
  const ids = new Set(kept.flatMap((group) => group.waiting.map((item) => item.row.question.id)));
  return {
    groups: { ...groups, waiting: groups.waiting.filter((row) => ids.has(row.question.id)) },
    branchGroups: kept,
  };
};

type SearchParams = {
  readonly rows: ReadonlyArray<QuestionRow>;
  readonly search: string;
};

export const answeredMatchingOf = ({ rows, search }: SearchParams): ReadonlyArray<QuestionRow> => {
  const needle = search.trim().toLowerCase();
  if (needle === '') {
    return rows;
  }
  return rows.filter((row) =>
    [questionRowTitle({ row }), row.question.text, row.question.userAnswer ?? '']
      .join('\n')
      .toLowerCase()
      .includes(needle),
  );
};

type BranchSearchParams = {
  readonly groups: ReadonlyArray<QuestionBranchGroup>;
  readonly search: string;
};

export const answeredBranchGroupsOf = ({
  groups,
  search,
}: BranchSearchParams): ReadonlyArray<QuestionBranchGroup> =>
  groups
    .map((group) => {
      const matching = new Set(
        answeredMatchingOf({ rows: group.answered.map((item) => item.row), search }),
      );
      return {
        ...group,
        waiting: [],
        answered: group.answered.filter((item) => matching.has(item.row)),
      };
    })
    .filter((group) => group.answered.length > 0);

type OpenGroupsParams = {
  readonly groups: ReadonlyArray<QuestionBranchGroup>;
};

export const openBranchGroupsOf = ({
  groups,
}: OpenGroupsParams): ReadonlyArray<QuestionBranchGroup> =>
  groups.map((group) => ({ ...group, answered: [] })).filter((group) => group.waiting.length > 0);
