import type { ChatMessage } from '@goodboy/types';
import { buildChatTurnPrompt } from '../../workspace-chat/buildChatTurnPrompt';

export const ASK_QUESTION_MARKER = 'New question:\n';

type Params = {
  readonly pack: string;
  readonly history: ReadonlyArray<ChatMessage>;
  readonly question: string;
};

export const buildAskTurnPrompt = ({ pack, history, question }: Params): string => {
  const turn = buildChatTurnPrompt({ history, question });
  const body = turn.includes(ASK_QUESTION_MARKER) ? turn : `${ASK_QUESTION_MARKER}${turn}`;
  return `${pack}\n\n${body}`;
};
