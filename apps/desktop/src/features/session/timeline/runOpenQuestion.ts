import type { OpenQuestion } from '@goodboy/types';
import type { TimelineAgentEntry, TimelineRunEntry } from './buildTimelineGroups';

export type RunOpenQuestion = {
  readonly question: OpenQuestion;
  readonly stepLabel: string | null;
};

type AgentParams = {
  readonly entry: TimelineAgentEntry;
};

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
};

export const runOpenQuestion = ({ entry }: RunParams): RunOpenQuestion | null =>
  oldestOf({
    candidates: entry.children.flatMap((child) =>
      child.kind === 'agent' ? agentOpenQuestions({ entry: child }) : [],
    ),
  });
