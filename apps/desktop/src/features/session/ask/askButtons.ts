import type { AgentId, OpenQuestionId } from '@goodboy/types';
import type { AskHandle } from './askHandles';
import type { ParsedAskAnswer } from './parseAskAnswer';

export type AskButton =
  | {
      readonly kind: 'answer';
      readonly key: string;
      readonly label: string;
      readonly questionId: OpenQuestionId;
      readonly prefill: string;
    }
  | {
      readonly kind: 'tell';
      readonly key: string;
      readonly label: string;
      readonly agentId: AgentId;
      readonly prefill: string;
    }
  | { readonly kind: 'review'; readonly key: string; readonly label: string };

export type AskButtonFacts = {
  readonly openQuestions: ReadonlyArray<{ readonly id: OpenQuestionId; readonly number: number }>;
  readonly messageableAgents: ReadonlyArray<{ readonly id: AgentId; readonly name: string }>;
  readonly readyCount: number;
};

type Params = {
  readonly answer: ParsedAskAnswer;
  readonly facts: AskButtonFacts;
};

const MAX_BUTTONS = 3;

const isReviewCitation = (handle: AskHandle): boolean =>
  handle.target.kind === 'pr' || handle.target.kind === 'run' || handle.target.kind === 'comment';

export const askButtons = ({ answer, facts }: Params): ReadonlyArray<AskButton> => {
  const buttons: Array<AskButton> = [];
  const suggestion = answer.suggestion;
  const suggested = suggestion?.handle.target;
  const questionTargets = [
    ...(suggested?.kind === 'question' ? [suggested.questionId] : []),
    ...answer.cited.flatMap((handle) =>
      handle.target.kind === 'question' ? [handle.target.questionId] : [],
    ),
  ];
  const question = facts.openQuestions.find((candidate) => questionTargets.includes(candidate.id));
  if (question !== undefined) {
    buttons.push({
      kind: 'answer',
      key: `answer:${question.id}`,
      label: `Answer question ${question.number}`,
      questionId: question.id,
      prefill:
        suggested?.kind === 'question' && suggested.questionId === question.id
          ? (suggestion?.text ?? '')
          : '',
    });
  }
  if (facts.readyCount > 0 && answer.cited.some(isReviewCitation)) {
    buttons.push({ kind: 'review', key: 'review', label: `Review ${facts.readyCount} to review` });
  }
  const agentTargets = [
    ...(suggested?.kind === 'agent' ? [suggested.agentId] : []),
    ...answer.cited.flatMap((handle) =>
      handle.target.kind === 'agent' ? [handle.target.agentId] : [],
    ),
  ];
  const agent = agentTargets
    .map((id) => facts.messageableAgents.find((candidate) => candidate.id === id))
    .find((candidate) => candidate !== undefined);
  if (agent !== undefined) {
    buttons.push({
      kind: 'tell',
      key: `tell:${agent.id}`,
      label: `Tell ${agent.name}…`,
      agentId: agent.id,
      prefill:
        suggested?.kind === 'agent' && suggested.agentId === agent.id
          ? (suggestion?.text ?? '')
          : '',
    });
  }
  return buttons.slice(0, MAX_BUTTONS);
};
