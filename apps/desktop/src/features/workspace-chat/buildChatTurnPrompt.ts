import type { ChatMessage } from '@goodboy/types';

type Params = {
  readonly history: ReadonlyArray<ChatMessage>;
  readonly question: string;
};

const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_CHARS = 24_000;

const speakerOf = (message: ChatMessage): string =>
  message.role === 'user' ? 'User' : 'Assistant';

const usableHistory = (history: ReadonlyArray<ChatMessage>): ReadonlyArray<string> => {
  const lines = history
    .filter((message) => message.content.trim() !== '')
    .filter((message) => message.role === 'user' || message.status !== 'failed')
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => `${speakerOf(message)}: ${message.content.trim()}`);
  const kept: string[] = [];
  let total = 0;
  for (const line of [...lines].reverse()) {
    if (total + line.length > MAX_HISTORY_CHARS) {
      break;
    }
    kept.unshift(line);
    total += line.length;
  }
  return kept;
};

export const buildChatTurnPrompt = ({ history, question }: Params): string => {
  const earlier = usableHistory(history);
  if (earlier.length === 0) {
    return question.trim();
  }
  return ['Earlier in this chat:', ...earlier, '', 'New question:', question.trim()].join('\n');
};
