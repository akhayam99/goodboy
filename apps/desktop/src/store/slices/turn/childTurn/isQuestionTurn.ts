import { parseChildClosing } from '@goodboy/core/auto';
import { hasBlockingQuestion } from '@goodboy/core/context';

type Params = {
  readonly assistantText: string;
  readonly agentId: string;
};

export const isQuestionTurn = ({ assistantText, agentId }: Params): boolean =>
  hasBlockingQuestion({ assistantText }) &&
  parseChildClosing({ text: assistantText, childAgentId: agentId }).completion !== 'blocked';
