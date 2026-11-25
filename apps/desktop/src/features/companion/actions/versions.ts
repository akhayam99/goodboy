import type { OpenQuestion, IntegrationDraft } from '@goodboy/types';

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const FNV_MASK = 0xffffffffffffffffn;
const FNV_WIDTH = 16;

type TextParams = {
  readonly text: string;
};

export const digestOf = ({ text }: TextParams): string => {
  let hash = FNV_OFFSET;
  for (const byte of new TextEncoder().encode(text)) {
    hash = ((hash ^ BigInt(byte)) * FNV_PRIME) & FNV_MASK;
  }
  return hash.toString(16).padStart(FNV_WIDTH, '0');
};

type ValueParams = {
  readonly value: unknown;
};

export const stableJsonOf = ({ value }: ValueParams): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item: unknown) => stableJsonOf({ value: item })).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJsonOf({ value: item })}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};

type PermissionParams = {
  readonly toolName: string;
  readonly input: unknown;
};

export const permissionHashOf = ({ toolName, input }: PermissionParams): string =>
  digestOf({ text: `${toolName}\u0000${stableJsonOf({ value: input })}` });

type QuestionParams = {
  readonly question: Pick<OpenQuestion, 'text' | 'suggestedAnswers'>;
};

export const questionVersionOf = ({ question }: QuestionParams): string =>
  digestOf({ text: `${question.text}\u0000${question.suggestedAnswers.join('\u0001')}` });

type DraftParams = {
  readonly draft: Pick<IntegrationDraft, 'body' | 'updatedAt'>;
};

export const slackDraftVersionOf = ({ draft }: DraftParams): string =>
  digestOf({ text: `${draft.updatedAt}\u0000${draft.body}` });
