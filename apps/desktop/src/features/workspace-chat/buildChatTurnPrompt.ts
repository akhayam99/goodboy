import type { ChatMessage } from '@goodboy/types';

type Params = {
  readonly history: ReadonlyArray<ChatMessage>;
  readonly question: string;
};

const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_CHARS = 24_000;

type MessageParams = {
  readonly message: ChatMessage;
};

const speakerOf = ({ message }: MessageParams): string =>
  message.role === 'user' ? 'User' : 'Assistant';

type HistoryParams = {
  readonly history: ReadonlyArray<ChatMessage>;
};

const lineOf = ({ message }: MessageParams): string => {
  const text = message.content.trim();
  const images = message.attachments.map((attachment) => attachment.fileName).join(', ');
  const imageNote = images === '' ? '' : `(attached images: ${images})`;
  return `${speakerOf({ message })}: ${[text, imageNote].filter((part) => part !== '').join(' ')}`;
};

const usableHistory = ({ history }: HistoryParams): ReadonlyArray<string> => {
  const lines = history
    .filter((message) => message.content.trim() !== '' || message.attachments.length > 0)
    .filter((message) => message.role === 'user' || message.status !== 'failed')
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => lineOf({ message }));
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
  const earlier = usableHistory({ history });
  if (earlier.length === 0) {
    return question.trim();
  }
  return ['Earlier in this chat:', ...earlier, '', 'New question:', question.trim()].join('\n');
};
