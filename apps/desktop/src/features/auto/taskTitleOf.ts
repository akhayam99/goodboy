import { DELEGATE_TITLE_WORDS } from '@goodboy/core';

type Params = {
  readonly request: Readonly<Record<string, unknown>>;
};

type TextParams = {
  readonly text: string;
};

const TITLE_CHARS = 60;
const SENTENCE_ENDS = ['. ', '? ', '! '];
const LEAD_MARKS = new Set(['#', '-', '*', '>', ' ']);

const isHeadingLine = ({ text }: TextParams): boolean => {
  const line = text.trim();
  return line.startsWith('#') || line.endsWith(':');
};

const firstLineOf = ({ text }: TextParams): string =>
  text
    .split('\n')
    .filter((line) => !isHeadingLine({ text: line }))
    .map((line) => {
      let start = 0;
      while (start < line.length && LEAD_MARKS.has(line.charAt(start))) {
        start += 1;
      }
      return line.slice(start).trim();
    })
    .find((line) => line !== '') ?? '';

const firstSentenceOf = ({ text }: TextParams): string => {
  const ends = SENTENCE_ENDS.map((end) => text.indexOf(end)).filter((index) => index >= 0);
  const sentence = ends.length === 0 ? text : text.slice(0, Math.min(...ends));
  const last = sentence.at(-1);
  return last === '.' || last === '?' || last === '!' ? sentence.slice(0, -1) : sentence;
};

const cutAtWordOf = ({ text }: TextParams): string => {
  if (text.length <= TITLE_CHARS) {
    return text;
  }
  const head = text.slice(0, TITLE_CHARS + 1);
  const space = head.lastIndexOf(' ');
  const cut = space > 0 ? head.slice(0, space) : text.slice(0, TITLE_CHARS);
  return `${cut.trimEnd()}…`;
};

const wordsOf = ({ text }: TextParams): string =>
  text
    .split(' ')
    .filter((word) => word !== '')
    .slice(0, DELEGATE_TITLE_WORDS)
    .join(' ');

export const taskTitleOf = ({ request }: Params): string | null => {
  const title = request['title'];
  if (typeof title === 'string') {
    const words = wordsOf({ text: title.replaceAll('\n', ' ').trim() });
    if (words !== '') {
      return words;
    }
  }
  const task = request['task'];
  if (typeof task !== 'string') {
    return null;
  }
  const sentence = firstSentenceOf({ text: firstLineOf({ text: task }) }).trim();
  return sentence === '' ? null : cutAtWordOf({ text: sentence });
};
