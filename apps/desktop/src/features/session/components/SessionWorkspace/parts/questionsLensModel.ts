import type { Agent, OpenQuestion, OpenQuestionId, SessionMountView } from '@goodboy/types';
import { partitionDelegatedQuestions } from '../../../../context/questionDelegate';
import { questionParts } from '../../../../context/components/QuestionsTab/questionParts';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { branchKeyedGroupsOf, NO_BRANCH_KEY, type BranchGroupHead } from '../../../branchGroupsOf';
import type { WorkBranch, WorkBranchProject } from '../../../workBranchesOf';
import { questionBranchesOf } from './questionBranchesOf';

type QuestionRowKind = 'waiting' | 'delegated' | 'staged' | 'dismissed' | 'answered';

export type QuestionRow = {
  readonly question: OpenQuestion;
  readonly kind: QuestionRowKind;
};

export type QuestionsLensModel = {
  readonly waiting: ReadonlyArray<QuestionRow>;
  readonly delegated: ReadonlyArray<QuestionRow>;
  readonly recent: ReadonlyArray<QuestionRow>;
  readonly answered: ReadonlyArray<QuestionRow>;
  readonly answerable: ReadonlyArray<OpenQuestion>;
  readonly blockingCount: number;
};

type Params = {
  readonly open: ReadonlyArray<OpenQuestion>;
  readonly answered: ReadonlyArray<OpenQuestion>;
  readonly agents: ReadonlyArray<Agent>;
  readonly staged: ReadonlyArray<OpenQuestionId>;
  readonly dismissed: OpenQuestion | null;
};

const newestAnsweredFirst = (first: OpenQuestion, second: OpenQuestion): number =>
  (second.answeredAt ?? second.createdAt).localeCompare(first.answeredAt ?? first.createdAt);

export const buildQuestionsLens = ({
  open,
  answered,
  agents,
  staged,
  dismissed,
}: Params): QuestionsLensModel => {
  const live = open.filter((question) => question.id !== dismissed?.id);
  const partition = partitionDelegatedQuestions({ questions: live, agents });
  const waiting = partition.answerable.filter((question) => !staged.includes(question.id));
  const stagedRows = partition.answerable
    .filter((question) => staged.includes(question.id))
    .map((question): QuestionRow => ({ question, kind: 'staged' }));
  const dismissedRows: ReadonlyArray<QuestionRow> =
    dismissed === null ? [] : [{ question: dismissed, kind: 'dismissed' }];

  return {
    waiting: waiting.map((question) => ({ question, kind: 'waiting' })),
    delegated: partition.waiting.map((question) => ({ question, kind: 'delegated' })),
    recent: [...stagedRows, ...dismissedRows],
    answered: [...answered]
      .sort(newestAnsweredFirst)
      .map((question) => ({ question, kind: 'answered' })),
    answerable: partition.answerable,
    blockingCount: waiting.filter((question) => question.isBlocking).length,
  };
};

type RowParams = {
  readonly row: QuestionRow;
};

export const questionRowTitle = ({ row }: RowParams): string =>
  questionParts({ text: row.question.text }).title;

type ModelParams = {
  readonly model: QuestionsLensModel;
};

export type QuestionGroups = {
  readonly waiting: ReadonlyArray<QuestionRow>;
  readonly answered: ReadonlyArray<QuestionRow>;
};

export const questionGroupsOf = ({ model }: ModelParams): QuestionGroups => ({
  waiting: [...model.waiting, ...model.delegated],
  answered: [...model.recent, ...model.answered],
});

export type QuestionBranchRow = Readonly<{
  row: QuestionRow;
  branches: ReadonlyArray<WorkBranch>;
}>;

export type QuestionBranchGroup = Readonly<{
  key: string;
  head: BranchGroupHead;
  waiting: ReadonlyArray<QuestionBranchRow>;
  answered: ReadonlyArray<QuestionBranchRow>;
}>;

type BranchGroupsParams = {
  readonly model: QuestionsLensModel;
  readonly agents: ReadonlyArray<Agent>;
  readonly sessionMounts: ReadonlyArray<SessionMountView>;
  readonly projects: ReadonlyArray<WorkBranchProject>;
  readonly mounts: ReadonlyArray<MountRowView>;
};

export const questionBranchGroupsOf = ({
  model,
  agents,
  sessionMounts,
  projects,
  mounts,
}: BranchGroupsParams): ReadonlyArray<QuestionBranchGroup> => {
  const groups = questionGroupsOf({ model });
  const waitingRows = new Set<QuestionRow>(groups.waiting);
  const entries = [...groups.waiting, ...groups.answered].map((row) => {
    const branches = questionBranchesOf({
      question: row.question,
      agents,
      mounts: sessionMounts,
      projects,
    });
    return { item: { row, branches }, branches };
  });
  const keyed = branchKeyedGroupsOf({ entries, mounts }).map((group): QuestionBranchGroup => ({
    key: group.key,
    head: group.head,
    waiting: group.items.filter((item) => waitingRows.has(item.row)),
    answered: group.items.filter((item) => !waitingRows.has(item.row)),
  }));
  const named = keyed.filter((group) => group.key !== NO_BRANCH_KEY);
  const none = keyed.filter((group) => group.key === NO_BRANCH_KEY);
  return [
    ...named.filter((group) => group.waiting.length > 0),
    ...named.filter((group) => group.waiting.length === 0),
    ...none,
  ];
};

type CountParams = {
  readonly groups: ReadonlyArray<QuestionBranchGroup>;
};

export const questionBranchCountOf = ({ groups }: CountParams): number =>
  groups.filter((group) => group.key !== NO_BRANCH_KEY).length;

export const questionRowsOf = ({ model }: ModelParams): ReadonlyArray<QuestionRow> => {
  const groups = questionGroupsOf({ model });
  return [...groups.waiting, ...groups.answered];
};

type NextParams = {
  readonly model: QuestionsLensModel;
  readonly from: OpenQuestionId;
};

export const nextWaitingQuestion = ({ model, from }: NextParams): OpenQuestionId | null => {
  const ids = model.waiting.map((row) => row.question.id);
  const start = ids.indexOf(from);
  const rest = start === -1 ? ids : [...ids.slice(start + 1), ...ids.slice(0, start)];
  return rest.find((id) => id !== from) ?? null;
};
