import { parseRunSummaryText } from '@goodboy/core';

type Params = {
  readonly text: string | null | undefined;
};

type CharParams = {
  readonly char: string | undefined;
};

type SentenceParams = {
  readonly sentence: string;
};

type TextParams = {
  readonly text: string;
};

const STEP_ARROWS: ReadonlyArray<string> = [' -> ', ' => ', ' → '];

const isSentenceEnd = ({ char }: CharParams): boolean =>
  char === '.' || char === '!' || char === '?';

const isBlank = ({ char }: CharParams): boolean => char === undefined || char.trim() === '';

const withoutPeriod = ({ sentence }: SentenceParams): string =>
  sentence.endsWith('.') ? sentence.slice(0, -1) : sentence;

const beforeArrow = ({ sentence }: SentenceParams): string => {
  const cuts = STEP_ARROWS.map((arrow) => sentence.indexOf(arrow)).filter((index) => index > 0);
  return cuts.length === 0 ? sentence : sentence.slice(0, Math.min(...cuts)).trim();
};

const isStructured = ({ text }: TextParams): boolean =>
  text.startsWith('{') || text.startsWith('[');

const recapLineOf = ({ text }: TextParams): string | null =>
  parseRunSummaryText(text)?.done.find((line) => line.trim() !== '') ?? null;

export const firstSentenceOf = ({ text }: Params): string | null => {
  const trimmed = (text ?? '').trim();
  if (isStructured({ text: trimmed })) {
    const recap = recapLineOf({ text: trimmed });
    return recap === null || isStructured({ text: recap })
      ? null
      : firstSentenceOf({ text: recap });
  }
  const line = trimmed
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part !== '');
  if (line === undefined) {
    return null;
  }
  for (let index = 0; index < line.length; index += 1) {
    if (isSentenceEnd({ char: line[index] }) && isBlank({ char: line[index + 1] })) {
      return withoutPeriod({ sentence: beforeArrow({ sentence: line.slice(0, index + 1) }) });
    }
  }
  return withoutPeriod({ sentence: beforeArrow({ sentence: line }) });
};
