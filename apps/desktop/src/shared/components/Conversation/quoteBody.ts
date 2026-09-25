import type { ConversationMessage } from './types';

const QUOTED_LINES = 3;

type Params = {
  readonly message: ConversationMessage;
  readonly text: string;
};

export const quoteBody = ({ message, text }: Params): string => {
  const quoted = message.body
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '')
    .slice(0, QUOTED_LINES)
    .map((line) => `> ${line}`)
    .join('\n');
  const mention = message.author.handle == null ? '' : `@${message.author.handle} `;
  if (quoted === '') {
    return `${mention}${text}`;
  }
  return `${quoted}\n\n${mention}${text}`;
};
