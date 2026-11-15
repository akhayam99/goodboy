import type { ChildNeeds } from './closing';
import { substepNeedsLine } from './digest';
import { AUTO_TREE_LIMITS } from './limits';
import { oneLine } from './oneLine';
import {
  isQuestionPayload,
  isRefusalPayload,
  isResultsPayload,
  isUserPayload,
  type QuestionPayload,
  type RefusalPayload,
  type ResultsPayload,
  type UserFacts,
  type UserPayload,
} from './outboxPayload';
import { isAutoMountedCode } from './refusals';
import {
  renderDelegationResult,
  renderPartialResult,
  storedResultOf,
  type DelegationResultV1,
} from './result';

export type DeliveryRow = Readonly<{
  id: string;
  payload: unknown;
}>;

export type WaitingReturn = Readonly<{
  result: DelegationResultV1;
  returns: number;
  isClosed: boolean;
  isRebriefClosed: boolean;
}>;

export type BuildDeliveryParams = Readonly<{
  ledgerBlock: string;
  budgetLine: string;
  mountsLine: string;
  digestBlock: string;
  artifactsBlock: string;
  rows: ReadonlyArray<DeliveryRow>;
  childLabels: ReadonlyMap<string, string>;
  isRestart: boolean;
  waiting?: ReadonlyArray<WaitingReturn>;
}>;

export const AUTO_RESTART_NOTICE =
  'Goodboy restarted while you were answering. Your last answer was cut short. Read the results below again and continue from them.';

const NEEDS_TEXT = {
  shell: 'an agent that can run commands',
  writer: 'an agent that can change files',
  decision: 'a decision from you',
  user: 'an answer from the user',
  dependency: 'a dependency the user allows',
  protected_file: 'a protected file the user allows',
} as const satisfies Readonly<Record<Exclude<ChildNeeds['kind'], 'role'>, string>>;

type NeedsTextParams = {
  readonly needs: ChildNeeds;
};

const needsTextOf = ({ needs }: NeedsTextParams): string =>
  needs.kind === 'role' ? `the ${needs.role} role` : NEEDS_TEXT[needs.kind];

type WaitingBlockParams = {
  readonly waiting: ReadonlyArray<WaitingReturn>;
  readonly childLabels: ReadonlyMap<string, string>;
};

type WaitingLinesParams = {
  readonly entry: WaitingReturn;
  readonly childLabels: ReadonlyMap<string, string>;
};

const waitingLinesOf = ({ entry, childLabels }: WaitingLinesParams): ReadonlyArray<string> => {
  const { result } = entry;
  const label = childLabels.get(result.childAgentId);
  const who =
    label === undefined
      ? `${result.role} ${result.childAgentId}`
      : `${label} (${result.role} ${result.childAgentId})`;
  const needs = result.returned?.needs ?? null;
  const request = result.returned?.request ?? null;
  const report = result.declared.summary;
  const times = entry.returns === 1 ? 'once' : `${entry.returns} times`;
  return [
    `- ${who}, delegation ${result.delegationId}, came back ${times}:`,
    ...(request === null ? [] : [`  it asks: ${oneLine({ text: request })}`]),
    ...(needs === null ? [] : [`  it needs: ${needsTextOf({ needs })}`]),
    `  its report: ${report === '' ? 'none' : oneLine({ text: report })}`,
    ...(entry.isClosed
      ? [
          `  it came back more than ${AUTO_TREE_LIMITS.returnsPerDelegation} times, so it cannot be continued: hand the task to another role with "replaces" or ask the user with a propose block whose child names it with "retryOf" or "replaces"`,
        ]
      : []),
    ...(entry.isRebriefClosed
      ? [
          `  its task was handed to a new agent ${AUTO_TREE_LIMITS.rebriefsPerTask} times already: ask the user with a propose block whose child names it with "retryOf" or "replaces"`,
        ]
      : []),
  ];
};

const waitingBlock = ({ waiting, childLabels }: WaitingBlockParams): string | null => {
  if (waiting.length === 0) {
    return null;
  }
  return [
    'WAITING FOR YOUR DECISION',
    'Each agent below came back to you and waits for your decision. Decide about each one: continue it with "retryOf", hand its task to another role with "replaces", release it with a release block, or ask the user with a propose block whose child names it with "retryOf" or "replaces". One you leave without a decision comes back next turn and counts as a turn without progress.',
    ...waiting.flatMap((entry) => waitingLinesOf({ entry, childLabels })),
  ].join('\n');
};

type ResultsBlockParams = {
  readonly payloads: ReadonlyArray<ResultsPayload>;
  readonly childLabels: ReadonlyMap<string, string>;
};

const resultsBlock = ({ payloads, childLabels }: ResultsBlockParams): string | null => {
  if (payloads.length === 0) {
    return null;
  }
  const lines = payloads.flatMap((payload) => [
    `Results of batch ${payload.batchId}:`,
    ...payload.results.map((value) => {
      const result = storedResultOf({ value });
      if (result === null) {
        return renderPartialResult({ entry: value });
      }
      const label = childLabels.get(result.childAgentId);
      return renderDelegationResult({ result, ...(label !== undefined && { label }) });
    }),
  ]);
  return [
    'RESULTS FROM YOUR AGENTS',
    'The user sees each result below as the card of the agent that made it, with its own report, right above your reply. Name an agent as it is named here.',
    ...lines,
  ].join('\n');
};

type QuestionsBlockParams = {
  readonly payloads: ReadonlyArray<QuestionPayload>;
};

const questionsBlock = ({ payloads }: QuestionsBlockParams): string | null => {
  if (payloads.length === 0) {
    return null;
  }
  const lines = payloads.flatMap((question) => {
    const suggestions =
      question.suggestedAnswers.length === 0
        ? []
        : [`  options: ${question.suggestedAnswers.join(' | ')}`];
    const recommended =
      question.recommendedAnswer === null ? [] : [`  recommended: ${question.recommendedAnswer}`];
    const needs =
      question.needs === undefined ? [] : [`  ${substepNeedsLine({ needs: question.needs })}`];
    return [
      `- ${question.role} ${question.childAgentId} asks (delegation ${question.delegationId}, question ${question.questionId}):`,
      `  ${question.text.replace(/\s+/g, ' ').trim()}`,
      ...suggestions,
      ...recommended,
      ...needs,
      `  Answer it with an answer block for delegation ${question.delegationId} and question ${question.questionId}, or ask the user in this chat.`,
    ];
  });
  return ['QUESTIONS FROM YOUR AGENTS', ...lines].join('\n');
};

type RefusalsBlockParams = {
  readonly payloads: ReadonlyArray<RefusalPayload>;
};

const refusalsBlock = ({ payloads }: RefusalsBlockParams): string | null => {
  if (payloads.length === 0) {
    return null;
  }
  const done = payloads.filter((payload) => isAutoMountedCode({ code: payload.code }));
  const refused = payloads.filter((payload) => !isAutoMountedCode({ code: payload.code }));
  const doneLines = done.flatMap((payload) => payload.text.split('\n').map((line) => `- ${line}`));
  const lines = refused.flatMap((payload) => [
    `- your ${payload.action} block was refused (${payload.code}):`,
    ...payload.text.split('\n').map((line) => `  ${line}`),
  ]);
  return [
    ...(doneLines.length === 0
      ? []
      : ['DONE BY GOODBOY', ...doneLines, 'Tell the user it is done and go on with the request.']),
    ...(lines.length === 0
      ? []
      : [
          'REFUSED, NOT DONE',
          ...lines,
          'Nothing in the refused blocks was started. Choose again; do not send the same block.',
        ]),
  ].join('\n');
};

type FactsLinesParams = {
  readonly facts: UserFacts;
};

const factsLines = ({ facts }: FactsLinesParams): ReadonlyArray<string> => {
  const lines: string[] = [];
  if (facts.focusArtifactId !== null) {
    lines.push(`  the user had artifact ${facts.focusArtifactId} open`);
  }
  if (facts.attachedArtifacts.length > 0) {
    lines.push(
      `  attached: ${facts.attachedArtifacts.map((ref) => `${ref.id} v${ref.revision}`).join(', ')}`,
    );
  }
  if (facts.explicitChange !== null) {
    lines.push(
      `  this asks to change ${facts.explicitChange.artifactId} from version ${facts.explicitChange.baseRevision} (comments ${facts.explicitChange.commentIds.join(', ')})`,
    );
  }
  if (facts.lastResultArtifactIds.length > 0) {
    lines.push(`  artifacts in the last results: ${facts.lastResultArtifactIds.join(', ')}`);
  }
  if (facts.isAmbiguous) {
    lines.push('  more than one artifact could be meant and nothing says which: ask the user');
  }
  return lines;
};

type UserBlockParams = {
  readonly payloads: ReadonlyArray<UserPayload>;
};

const userBlock = ({ payloads }: UserBlockParams): string | null => {
  if (payloads.length === 0) {
    return null;
  }
  const lines = payloads.flatMap((payload, index) => [
    `${index + 1}. The user wrote:`,
    payload.text,
    ...factsLines({ facts: payload.facts }),
  ]);
  return ['MESSAGES FROM THE USER, OLDEST FIRST', ...lines].join('\n');
};

export const buildDeliveryText = ({
  ledgerBlock,
  budgetLine,
  mountsLine,
  digestBlock,
  artifactsBlock,
  rows,
  childLabels,
  isRestart,
  waiting = [],
}: BuildDeliveryParams): string => {
  const results: ResultsPayload[] = [];
  const questions: QuestionPayload[] = [];
  const refusals: RefusalPayload[] = [];
  const users: UserPayload[] = [];
  for (const row of rows) {
    const value = row.payload;
    if (isResultsPayload(value)) {
      if (value.isRepeat !== true) {
        results.push(value);
      }
      continue;
    }
    if (isQuestionPayload(value)) {
      questions.push(value);
      continue;
    }
    if (isRefusalPayload(value)) {
      refusals.push(value);
      continue;
    }
    if (isUserPayload(value)) {
      users.push(value);
    }
  }
  const blocks = [
    isRestart ? AUTO_RESTART_NOTICE : null,
    waitingBlock({ waiting, childLabels }),
    ledgerBlock,
    budgetLine,
    mountsLine,
    digestBlock,
    refusalsBlock({ payloads: refusals }),
    resultsBlock({ payloads: results, childLabels }),
    artifactsBlock,
    questionsBlock({ payloads: questions }),
    userBlock({ payloads: users }),
  ];
  return blocks.filter((block): block is string => block !== null && block !== '').join('\n\n');
};
