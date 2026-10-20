import { escapeControlCharsInStrings } from '../providers/shared/escapeControlCharsInStrings';

export const AUTO_BLOCK_OPEN = '<<auto>>';
export const AUTO_BLOCK_CLOSE = '<</auto>>';

export const AUTO_BLOCK_ACTIONS = ['delegate', 'answer', 'finish'] as const;

const FIELD_CHARS = 1_000;
const ANSWER_CHARS = 8_000;
const SUMMARY_CHARS = 4_000;

export type AutoBlock =
  | Readonly<{ action: 'delegate'; requestId: string | null; spec: string }>
  | Readonly<{
      action: 'answer';
      delegation: string;
      question: string;
      text: string;
      artifact: string | null;
    }>
  | Readonly<{ action: 'finish'; summary: string }>;

export type AutoBlockOutcome =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'invalid'; reason: string }>
  | Readonly<{ kind: 'block'; block: AutoBlock }>;

export type ParseAutoBlockParams = Readonly<{
  text: string;
}>;

type RecordValue = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type TextParams = {
  readonly value: unknown;
  readonly max: number;
};

const textOf = ({ value, max }: TextParams): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed.slice(0, max);
};

type SliceParams = {
  readonly value: string;
};

const stripCodeFences = ({ value }: SliceParams): string =>
  value
    .trim()
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

const parseJson = ({ value }: SliceParams): unknown => {
  const candidate = stripCodeFences({ value });
  try {
    return JSON.parse(candidate);
  } catch {
    try {
      return JSON.parse(escapeControlCharsInStrings({ value: candidate }));
    } catch {
      return undefined;
    }
  }
};

type BlockSliceParams = {
  readonly text: string;
};

const lastCompleteSlice = ({ text }: BlockSliceParams): string | null => {
  let search = text.length;
  while (search >= 0) {
    const start = text.lastIndexOf(AUTO_BLOCK_OPEN, search);
    if (start < 0) {
      return null;
    }
    const contentStart = start + AUTO_BLOCK_OPEN.length;
    const end = text.indexOf(AUTO_BLOCK_CLOSE, contentStart);
    if (end >= 0) {
      return text.slice(contentStart, end);
    }
    search = start - 1;
  }
  return null;
};

const unclosedSlice = ({ text }: BlockSliceParams): string | null => {
  const start = text.lastIndexOf(AUTO_BLOCK_OPEN);
  if (start < 0) {
    return null;
  }
  const contentStart = start + AUTO_BLOCK_OPEN.length;
  const lastBrace = text.lastIndexOf('}');
  if (lastBrace < contentStart) {
    return null;
  }
  return text.slice(contentStart, lastBrace + 1);
};

type InvalidParams = {
  readonly reason: string;
};

const invalid = ({ reason }: InvalidParams): AutoBlockOutcome => ({ kind: 'invalid', reason });

type FieldsParams = {
  readonly fields: RecordValue;
};

const delegateOf = ({ fields }: FieldsParams): AutoBlockOutcome => {
  const children = fields['children'];
  if (!Array.isArray(children)) {
    return invalid({ reason: 'a delegate block needs a "children" list' });
  }
  const rawId = fields['requestId'];
  if (
    rawId !== undefined &&
    rawId !== null &&
    textOf({ value: rawId, max: FIELD_CHARS }) === null
  ) {
    return invalid({ reason: '"requestId" must be a non-empty string' });
  }
  return {
    kind: 'block',
    block: {
      action: 'delegate',
      requestId: textOf({ value: rawId, max: FIELD_CHARS }),
      spec: JSON.stringify({ children }),
    },
  };
};

const answerOf = ({ fields }: FieldsParams): AutoBlockOutcome => {
  const delegation = textOf({ value: fields['delegation'], max: FIELD_CHARS });
  const question = textOf({ value: fields['question'], max: FIELD_CHARS });
  const text = textOf({ value: fields['text'], max: ANSWER_CHARS });
  if (delegation === null || question === null || text === null) {
    return invalid({ reason: 'an answer block needs "delegation", "question" and "text"' });
  }
  const artifact = textOf({ value: fields['artifact'], max: FIELD_CHARS });
  return { kind: 'block', block: { action: 'answer', delegation, question, text, artifact } };
};

const finishOf = ({ fields }: FieldsParams): AutoBlockOutcome => {
  const summary = textOf({ value: fields['summary'], max: SUMMARY_CHARS });
  if (summary === null) {
    return invalid({ reason: 'a finish block needs a "summary"' });
  }
  return { kind: 'block', block: { action: 'finish', summary } };
};

export const parseAutoBlock = ({ text }: ParseAutoBlockParams): AutoBlockOutcome => {
  const slice = lastCompleteSlice({ text }) ?? unclosedSlice({ text });
  if (slice === null) {
    return text.includes(AUTO_BLOCK_OPEN)
      ? invalid({ reason: 'the block is not closed and holds no JSON object' })
      : { kind: 'none' };
  }
  const parsed = parseJson({ value: slice });
  if (!isRecord(parsed)) {
    return invalid({ reason: 'the block does not hold one JSON object' });
  }
  switch (parsed['action']) {
    case 'delegate':
      return delegateOf({ fields: parsed });
    case 'answer':
      return answerOf({ fields: parsed });
    case 'finish':
      return finishOf({ fields: parsed });
    default:
      return invalid({
        reason: `"action" must be one of ${AUTO_BLOCK_ACTIONS.join(', ')}`,
      });
  }
};
