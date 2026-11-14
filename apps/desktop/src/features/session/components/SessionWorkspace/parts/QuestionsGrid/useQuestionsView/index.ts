import { useMemo, useState } from 'react';
import {
  ALL_QUESTIONS_FILTER,
  answeredBranchGroupsOf,
  answeredMatchingOf,
  filterOpenQuestions,
  openBranchGroupsOf,
  questionFilterChipsOf,
  type QuestionFilterChip,
} from '../../questionsFilterModel';
import type { QuestionBranchGroup, QuestionGroups, QuestionRow } from '../../questionsLensModel';

type Params = {
  readonly groups: QuestionGroups;
  readonly branchGroups: ReadonlyArray<QuestionBranchGroup>;
};

type PickParams = {
  readonly id: string;
};

type QuestionsView = {
  readonly chips: ReadonlyArray<QuestionFilterChip>;
  readonly activeChipId: string;
  readonly pickChip: (params: PickParams) => void;
  readonly search: string;
  readonly setSearch: (next: string) => void;
  readonly openRows: ReadonlyArray<QuestionRow>;
  readonly openBranchGroups: ReadonlyArray<QuestionBranchGroup>;
  readonly answeredRows: ReadonlyArray<QuestionRow>;
  readonly answeredBranchGroups: ReadonlyArray<QuestionBranchGroup>;
};

export const useQuestionsView = ({ groups, branchGroups }: Params): QuestionsView => {
  const [pickedChipId, setPickedChipId] = useState('all');
  const [search, setSearch] = useState('');
  const chips = useMemo(
    () => questionFilterChipsOf({ groups, branchGroups }),
    [groups, branchGroups],
  );
  const activeChip = chips.find((chip) => chip.id === pickedChipId) ?? chips[0];
  const activeFilter = activeChip?.filter ?? ALL_QUESTIONS_FILTER;
  const open = useMemo(
    () => filterOpenQuestions({ filter: activeFilter, groups, branchGroups }),
    [activeFilter, groups, branchGroups],
  );
  const openBranchGroups = useMemo(
    () => openBranchGroupsOf({ groups: open.branchGroups }),
    [open.branchGroups],
  );
  const answeredBranchGroups = useMemo(
    () => answeredBranchGroupsOf({ groups: branchGroups, search }),
    [branchGroups, search],
  );
  const answeredRows = useMemo(
    () => answeredMatchingOf({ rows: groups.answered, search }),
    [groups.answered, search],
  );
  return {
    chips,
    activeChipId: activeChip?.id ?? 'all',
    pickChip: ({ id }) => setPickedChipId(id),
    search,
    setSearch,
    openRows: open.groups.waiting,
    openBranchGroups,
    answeredRows,
    answeredBranchGroups,
  };
};
