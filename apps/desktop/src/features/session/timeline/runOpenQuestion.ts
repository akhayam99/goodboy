import type { OpenQuestion } from '@goodboy/types';
import { askingAgentBatch } from '../../context/askingAgentBatch';
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

type RunParams = {
  readonly entry: TimelineRunEntry;
  readonly shownQuestionIds?: ReadonlySet<string>;
};

const runOpenQuestions = ({ entry }: RunParams): ReadonlyArray<RunOpenQuestion> =>
  entry.children.flatMap((child) =>
    child.kind === 'agent' ? agentOpenQuestions({ entry: child }) : [],
  );

export const runOpenQuestionBatch = ({
  entry,
  shownQuestionIds = NO_SHOWN_QUESTIONS,
}: RunParams): ReadonlyArray<RunOpenQuestion> => {
  const candidates = new Map(
    runOpenQuestions({ entry })
      .filter((candidate) => !shownQuestionIds.has(candidate.question.id))
      .map((candidate) => [candidate.question.id, candidate]),
  );
  return askingAgentBatch({
    questions: [...candidates.values()].map((candidate) => candidate.question),
  }).flatMap((question) => candidates.get(question.id) ?? []);
};

export const runOpenQuestion = ({
  entry,
  shownQuestionIds = NO_SHOWN_QUESTIONS,
}: RunParams): RunOpenQuestion | null =>
  runOpenQuestionBatch({ entry, shownQuestionIds })[0] ?? null;

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
