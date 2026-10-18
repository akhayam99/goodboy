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
import { renderDelegationResult } from './result';

export type DeliveryRow = Readonly<{
  id: string;
  payload: unknown;
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
}>;

export const AUTO_RESTART_NOTICE =
  'Goodboy restarted while you were answering. Your last answer was cut short. Read the results below again and continue from them.';

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
    ...payload.results.map((result) => {
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
    return [
      `- ${question.role} ${question.childAgentId} asks (delegation ${question.delegationId}, question ${question.questionId}):`,
      `  ${question.text.replace(/\s+/g, ' ').trim()}`,
      ...suggestions,
      ...recommended,
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
  const lines = payloads.flatMap((payload) => [
    `- your ${payload.action} block was refused (${payload.code}):`,
    ...payload.text.split('\n').map((line) => `  ${line}`),
  ]);
  return [
    'REFUSED, NOT DONE',
    ...lines,
    'Nothing in the refused blocks was started. Choose again; do not send the same block.',
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
}: BuildDeliveryParams): string => {
  const results: ResultsPayload[] = [];
  const questions: QuestionPayload[] = [];
  const refusals: RefusalPayload[] = [];
  const users: UserPayload[] = [];
  for (const row of rows) {
    const value = row.payload;
    if (isResultsPayload(value)) {
      results.push(value);
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
