import type {
  Agent,
  AgentSourceKind,
  AgentStatus,
  OpenQuestion,
  OpenQuestionId,
} from '@goodboy/types';

export const QUESTION_DELEGATE_SOURCE_KIND: AgentSourceKind = 'open_question';

export const QUESTION_DELEGATE_COPY = {
  offer: 'let an agent answer',
  running: 'an agent is answering this',
  retry: 'the agent could not answer. hand it over again',
  blocked: "a delegated agent can't delegate again. this one is yours to answer",
  recap: 'an agent answers',
  panelTitle: 'an agent answers for you',
  panelHint: 'the answer counts as yours. hints are optional.',
  hintsPlaceholder: 'what to weigh, what to rule out. leave empty and the agent decides.',
  hintsLabel: 'Hints',
  back: 'answer it yourself',
} as const;

const NAME_BUDGET = 48;

const TERMINAL_STATUSES: ReadonlyArray<AgentStatus> = ['completed', 'failed', 'skipped'];

type AgentParam = {
  readonly agent: Agent;
};

export const isQuestionDelegate = ({ agent }: AgentParam): boolean =>
  agent.sourceKind === QUESTION_DELEGATE_SOURCE_KIND;

export const isLiveDelegate = ({ agent }: AgentParam): boolean =>
  !TERMINAL_STATUSES.includes(agent.status);

type ClipParams = {
  readonly text: string;
  readonly budget?: number;
};

export const clipQuestionText = ({ text, budget = NAME_BUDGET }: ClipParams): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= budget) {
    return flat;
  }
  return `${flat.slice(0, budget - 1).trimEnd()}…`;
};

export const delegateAgentName = ({ questionText }: { readonly questionText: string }): string =>
  `answer: ${clipQuestionText({ text: questionText })}`;

type DelegatesParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly questionId: OpenQuestionId;
};

export const questionDelegates = ({ agents, questionId }: DelegatesParams): ReadonlyArray<Agent> =>
  agents
    .filter((agent) => isQuestionDelegate({ agent }) && agent.sourceThreadId === questionId)
    .sort((first, second) => first.ordinal - second.ordinal);

export const latestQuestionDelegate = ({ agents, questionId }: DelegatesParams): Agent | null => {
  const found = questionDelegates({ agents, questionId });
  return found[found.length - 1] ?? null;
};

export const liveQuestionDelegate = ({ agents, questionId }: DelegatesParams): Agent | null => {
  const live = questionDelegates({ agents, questionId }).filter((agent) =>
    isLiveDelegate({ agent }),
  );
  return live[live.length - 1] ?? null;
};

type PartitionParams = {
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly agents: ReadonlyArray<Agent>;
};

export type DelegatedPartition = {
  readonly waiting: ReadonlyArray<OpenQuestion>;
  readonly answerable: ReadonlyArray<OpenQuestion>;
};

export const partitionDelegatedQuestions = ({
  questions,
  agents,
}: PartitionParams): DelegatedPartition => {
  const waiting: OpenQuestion[] = [];
  const answerable: OpenQuestion[] = [];
  for (const question of questions) {
    if (liveQuestionDelegate({ agents, questionId: question.id }) === null) {
      answerable.push(question);
    } else {
      waiting.push(question);
    }
  }
  return { waiting, answerable };
};

export const canDelegateQuestion = ({ asker }: { readonly asker: Agent | null }): boolean =>
  asker === null || !isQuestionDelegate({ agent: asker });

export type DelegateRowState = 'available' | 'chosen' | 'running' | 'retry' | 'blocked';

type RowStateParams = {
  readonly asker: Agent | null;
  readonly delegate: Agent | null;
  readonly isChosen: boolean;
};

export const delegateRowState = ({
  asker,
  delegate,
  isChosen,
}: RowStateParams): DelegateRowState => {
  if (!canDelegateQuestion({ asker })) {
    return 'blocked';
  }
  if (delegate !== null && isLiveDelegate({ agent: delegate })) {
    return 'running';
  }
  if (isChosen) {
    return 'chosen';
  }
  if (delegate?.status === 'failed') {
    return 'retry';
  }
  return 'available';
};

type KickoffParams = {
  readonly questionText: string;
  readonly hints: string;
};

export const composeDelegateKickoff = ({ questionText, hints }: KickoffParams): string => {
  const trimmedHints = hints.trim();
  const lines = [
    'You answer one open question for the user, on their behalf. Your answer becomes their answer.',
    '',
    `**Question** ${questionText.trim()}`,
  ];
  if (trimmedHints.length > 0) {
    lines.push(`**Hints from the user** ${trimmedHints}`);
  }
  lines.push(
    '',
    '**You are the last layer.** Nobody answers after you.',
    '**Answer with** exactly one `<<oq-answer>>` block holding the answer and nothing else.',
    '**Never emit** `<<fan-out>>`, `<<scout-split>>` or handoff markers, and never edit files.',
    '**If the user is the only one who can decide**, ask once with a single `<<ctx-question>>` block, in your own words, never repeating the question above, then stop.',
  );
  return lines.join('\n');
};

export const DELEGATE_NUDGE =
  'That reply carried no answer. Emit exactly one `<<oq-answer>>` block with the answer, or one `<<ctx-question>>` block if only the user can decide. Nothing else.';
