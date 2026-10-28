import { extractProseQuestion, stripControlMarkers } from '@goodboy/core';
import type { TurnEvent } from '@goodboy/types';
import { lastAssistantMessage } from '../../shared/utils/lastAssistantMessage';

export type BlockedQuestion = Readonly<{
  text: string;
  isQuestion: boolean;
}>;

const MAX_CLOSING_CHARS = 500;

const FENCED_BLOCK_PATTERN = /```[\s\S]*?(?:```|$)/g;

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
};

type ClampParams = {
  readonly text: string;
};

const clampAtWord = ({ text }: ClampParams): string => {
  if (text.length <= MAX_CLOSING_CHARS) {
    return text;
  }
  const lastSpace = text.lastIndexOf(' ', MAX_CLOSING_CHARS);
  return `${text.slice(0, lastSpace > 0 ? lastSpace : MAX_CLOSING_CHARS).trimEnd()}…`;
};

export const blockedQuestionOf = ({ events }: Params): BlockedQuestion | null => {
  const message = lastAssistantMessage({ events });
  if (message === null) {
    return null;
  }
  const question = extractProseQuestion({ assistantText: message.text });
  if (question !== null) {
    return { text: question, isQuestion: true };
  }
  const closing = stripControlMarkers(message.text)
    .replace(FENCED_BLOCK_PATTERN, '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .at(-1);
  return closing === undefined ? null : { text: clampAtWord({ text: closing }), isQuestion: false };
};
