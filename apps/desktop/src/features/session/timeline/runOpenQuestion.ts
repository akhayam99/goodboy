import type { OpenQuestion } from '@goodboy/types';
import { isQuestionDelegate } from '../../context/questionDelegate';
import type { TimelineAgentEntry, TimelineRunEntry } from './buildTimelineGroups';

export type RunOpenQuestion = {
  readonly question: OpenQuestion;
  readonly stepLabel: string | null;
};

type AgentParams = {
  readonly entry: TimelineAgentEntry;
};

const NO_SHOWN_QUESTIONS: ReadonlySet<string> = new Set();

const agentOpenQuestions = ({ entry }: AgentParams): ReadonlyArray<RunOpenQuestion> => [
  ...entry.openQuestions.map((question) => ({ question, stepLabel: entry.stepLabel })),
  ...entry.children.flatMap((child) => agentOpenQuestions({ entry: child })),
];

type OldestParams = {
  readonly candidates: ReadonlyArray<RunOpenQuestion>;
};

const oldestOf = ({ candidates }: OldestParams): RunOpenQuestion | null =>
  candidates.reduce<RunOpenQuestion | null>(
    (oldest, candidate) =>
      oldest == null || candidate.question.createdAt < oldest.question.createdAt
        ? candidate
        : oldest,
    null,
  );

export const oldestAgentOpenQuestion = ({ entry }: AgentParams): OpenQuestion | null =>
  oldestOf({
    candidates: entry.openQuestions.map((question) => ({ question, stepLabel: entry.stepLabel })),
  })?.question ?? null;

type RunParams = {
  readonly entry: TimelineRunEntry;
  readonly shownQuestionIds?: ReadonlySet<string>;
};

const runOpenQuestions = ({ entry }: RunParams): ReadonlyArray<RunOpenQuestion> =>
  entry.children.flatMap((child) =>
    child.kind === 'agent' ? agentOpenQuestions({ entry: child }) : [],
  );

export const runOpenQuestion = ({
  entry,
  shownQuestionIds = NO_SHOWN_QUESTIONS,
}: RunParams): RunOpenQuestion | null =>
  oldestOf({
    candidates: runOpenQuestions({ entry }).filter(
      (candidate) => !shownQuestionIds.has(candidate.question.id),
    ),
  });

export const hasShownRunQuestion = ({
  entry,
  shownQuestionIds = NO_SHOWN_QUESTIONS,
}: RunParams): boolean =>
  runOpenQuestions({ entry }).some((candidate) => shownQuestionIds.has(candidate.question.id));

type ShownAgentParams = {
  readonly entry: TimelineAgentEntry;
  readonly showSubagents: boolean;
};

const agentRowQuestionIds = ({ entry, showSubagents }: ShownAgentParams): ReadonlyArray<string> => [
  ...(isQuestionDelegate({ agent: entry.agent })
    ? []
    : entry.openQuestions.map((question) => question.id)),
  ...(showSubagents
    ? entry.children.flatMap((child) => agentRowQuestionIds({ entry: child, showSubagents }))
    : []),
];

type ShownRunParams = {
  readonly entry: TimelineRunEntry;
  readonly questionRowIds: ReadonlySet<string>;
  readonly showSubagents: boolean;
};

export const runShownQuestionIds = ({
  entry,
  questionRowIds,
  showSubagents,
}: ShownRunParams): ReadonlySet<string> =>
  new Set([
    ...questionRowIds,
    ...entry.children.flatMap((child) =>
      child.kind === 'agent' ? agentRowQuestionIds({ entry: child, showSubagents }) : [],
    ),
  ]);
