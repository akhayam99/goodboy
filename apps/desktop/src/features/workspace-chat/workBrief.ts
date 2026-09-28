import type { ChatMessage } from '@goodboy/types';
import { markdownPreview } from '../../shared/utils/markdownPreview';

export type WorkBrief = {
  readonly title: string;
  readonly goal: string;
  readonly know: ReadonlyArray<string>;
  readonly files: ReadonlyArray<string>;
  readonly project: string | null;
};

const KNOW_LIMIT = 3;
const FILE_LIMIT = 4;
const TITLE_LIMIT = 80;
const PATH_PATTERN = /(?:^|[\s(`])((?:[\w.-]+\/)+[\w.-]+\.[a-z]{1,5}(?::\d+)?)/gi;
const LIST_ITEM = /^\s*(?:[-*+]|\d+\.)\s+(.+)$/;

type DraftParams = {
  readonly title: string;
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly projectNames: ReadonlyArray<string>;
};

type TextParams = {
  readonly text: string;
};

const firstSentence = ({ text }: TextParams): string => {
  const plain = markdownPreview({ text });
  const end = plain.search(/[.!?](\s|$)/);
  return end === -1 ? plain : plain.slice(0, end + 1);
};

const pathsIn = ({ text }: TextParams): ReadonlyArray<string> =>
  Array.from(text.matchAll(PATH_PATTERN), (match) => match[1] ?? '').filter((path) => path !== '');

type ProjectParams = {
  readonly files: ReadonlyArray<string>;
  readonly projectNames: ReadonlyArray<string>;
};

const projectOf = ({ files, projectNames }: ProjectParams): string | null => {
  const named = files
    .map((file) => file.split('/')[0] ?? '')
    .find((segment) => projectNames.includes(segment));
  return named ?? projectNames[0] ?? null;
};

const unique = (values: ReadonlyArray<string>): ReadonlyArray<string> => [...new Set(values)];

export const draftWorkBrief = ({ title, messages, projectNames }: DraftParams): WorkBrief => {
  const question = messages.find((message) => message.role === 'user')?.content.trim() ?? title;
  const answer = [...messages].reverse().find((message) => message.role === 'assistant');
  const answerText = answer?.content ?? '';
  const lead = firstSentence({ text: answerText });
  const items = answerText
    .split('\n')
    .flatMap((line) => {
      const match = LIST_ITEM.exec(line);
      return match?.[1] === undefined ? [] : [markdownPreview({ text: match[1] })];
    })
    .filter((item) => item !== '');
  const files = unique([...pathsIn({ text: answerText }), ...(answer?.reads ?? [])]).slice(
    0,
    FILE_LIMIT,
  );
  return {
    title: title.replace(/\?$/, '').slice(0, TITLE_LIMIT),
    goal: lead === '' ? question : `Follow up on "${question}". ${lead}`,
    know: (items.length > 0 ? items : lead === '' ? [] : [lead]).slice(0, KNOW_LIMIT),
    files,
    project: projectOf({ files, projectNames }),
  };
};

type ParseParams = {
  readonly text: string;
  readonly fallback: WorkBrief;
  readonly projectNames: ReadonlyArray<string>;
};

const stringsOf = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
    : [];

const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const parsedObject = ({ text }: TextParams): Record<string, unknown> | null => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(text.slice(start, end + 1));
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value))
      : null;
  } catch {
    return null;
  }
};

export const parseWorkBrief = ({ text, fallback, projectNames }: ParseParams): WorkBrief => {
  const parsed = parsedObject({ text });
  if (parsed === null) {
    return fallback;
  }
  const title = textOf(parsed.title);
  const goal = textOf(parsed.goal);
  if (title === '' || goal === '') {
    return fallback;
  }
  const project = textOf(parsed.project);
  const files = stringsOf(parsed.files);
  return {
    title: title.slice(0, TITLE_LIMIT),
    goal,
    know: stringsOf(parsed.know).slice(0, KNOW_LIMIT),
    files: (files.length > 0 ? files : fallback.files).slice(0, FILE_LIMIT),
    project: projectNames.includes(project) ? project : fallback.project,
  };
};

type PromptParams = {
  readonly brief: WorkBrief;
};

export const workPromptOf = ({ brief }: PromptParams): string =>
  [
    brief.goal,
    ...(brief.know.length === 0
      ? []
      : ['', 'What we know:', ...brief.know.map((item) => `- ${item}`)]),
    ...(brief.files.length === 0 ? [] : ['', 'Files:', ...brief.files.map((file) => `- ${file}`)]),
  ].join('\n');
