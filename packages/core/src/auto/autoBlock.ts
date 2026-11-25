import { escapeControlCharsInStrings } from '../providers/shared/escapeControlCharsInStrings';
import { AUTO_CHILD_MESSAGE_CHARS } from './limits';
import { parseMountSpec } from './mountSpec';
import {
  GUIDE_CHANGES,
  GUIDE_DEVIATE_SHAPE,
  GUIDE_FOLLOW_SHAPE,
  GUIDE_HOLD_SHAPE,
} from './guideSpec';
import { parseProposeSpec } from './proposeSpec';
import { clippedTextOf, isRecord } from '@goodboy/types/helpers';

export const AUTO_BLOCK_OPEN = '<<auto>>';
export const AUTO_BLOCK_CLOSE = '<</auto>>';

export const AUTO_BLOCK_ACTIONS = [
  'delegate',
  'propose',
  'mount',
  'answer',
  'release',
  'message',
  'stop',
  'close',
  'finish',
  'follow',
  'hold',
  'deviate',
] as const;

export const AUTO_CLOSE_AS = ['done', 'skipped', 'discarded'] as const;

export type AutoCloseAs = (typeof AUTO_CLOSE_AS)[number];

const FIELD_CHARS = 1_000;
const ANSWER_CHARS = 8_000;
const SUMMARY_CHARS = 4_000;

export type AutoBlock =
  | Readonly<{ action: 'delegate'; requestId: string | null; spec: string }>
  | Readonly<{ action: 'propose'; requestId: string | null; spec: string }>
  | Readonly<{ action: 'mount'; project: string; branch: string | null; reason: string }>
  | Readonly<{
      action: 'answer';
      delegation: string;
      question: string;
      text: string;
      artifact: string | null;
    }>
  | Readonly<{ action: 'release'; delegation: string; reason: string }>
  | Readonly<{ action: 'message'; delegation: string; text: string }>
  | Readonly<{ action: 'stop'; delegation: string; reason: string }>
  | Readonly<{ action: 'close'; target: string; as: AutoCloseAs; reason: string }>
  | Readonly<{ action: 'finish'; summary: string }>
  | Readonly<{ action: 'follow'; check: string }>
  | Readonly<{ action: 'hold'; reason: string; suggest: string | null }>
  | Readonly<{
      action: 'deviate';
      change: (typeof GUIDE_CHANGES)[number];
      step: string;
      reason: string;
    }>;

export type AutoBlockOutcome =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'invalid'; reason: string }>
  | Readonly<{ kind: 'block'; block: AutoBlock }>;

export type ParseAutoBlockParams = Readonly<{
  text: string;
}>;

type RecordValue = Readonly<Record<string, unknown>>;

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
    clippedTextOf({ value: rawId, max: FIELD_CHARS }) === null
  ) {
    return invalid({ reason: '"requestId" must be a non-empty string' });
  }
  return {
    kind: 'block',
    block: {
      action: 'delegate',
      requestId: clippedTextOf({ value: rawId, max: FIELD_CHARS }),
      spec: JSON.stringify({ children }),
    },
  };
};

const proposeOf = ({ fields }: FieldsParams): AutoBlockOutcome => {
  const rawId = fields['requestId'];
  if (
    rawId !== undefined &&
    rawId !== null &&
    clippedTextOf({ value: rawId, max: FIELD_CHARS }) === null
  ) {
    return invalid({ reason: '"requestId" must be a non-empty string' });
  }
  const spec = JSON.stringify({ primary: fields['primary'], alternatives: fields['alternatives'] });
  const parsed = parseProposeSpec({ text: spec });
  if (parsed.kind === 'refused') {
    return invalid({ reason: parsed.message });
  }
  return {
    kind: 'block',
    block: {
      action: 'propose',
      requestId: clippedTextOf({ value: rawId, max: FIELD_CHARS }),
      spec,
    },
  };
};

const mountOf = ({ fields }: FieldsParams): AutoBlockOutcome => {
  const parsed = parseMountSpec({ fields });
  if (parsed.kind === 'invalid') {
    return invalid({ reason: parsed.reason });
  }
  return { kind: 'block', block: { action: 'mount', ...parsed.spec } };
};

const answerOf = ({ fields }: FieldsParams): AutoBlockOutcome => {
  const delegation = clippedTextOf({ value: fields['delegation'], max: FIELD_CHARS });
  const question = clippedTextOf({ value: fields['question'], max: FIELD_CHARS });
  const text = clippedTextOf({ value: fields['text'], max: ANSWER_CHARS });
  if (delegation === null || question === null || text === null) {
    return invalid({ reason: 'an answer block needs "delegation", "question" and "text"' });
  }
  const artifact = clippedTextOf({ value: fields['artifact'], max: FIELD_CHARS });
  return { kind: 'block', block: { action: 'answer', delegation, question, text, artifact } };
};

const releaseOf = ({ fields }: FieldsParams): AutoBlockOutcome => {
  const delegation = clippedTextOf({ value: fields['delegation'], max: FIELD_CHARS });
  const reason = clippedTextOf({ value: fields['reason'], max: FIELD_CHARS });
  if (delegation === null || reason === null) {
    return invalid({ reason: 'a release block needs "delegation" and "reason"' });
  }
  return { kind: 'block', block: { action: 'release', delegation, reason } };
};

const childMessageOf = ({ fields }: FieldsParams): AutoBlockOutcome => {
  const delegation = clippedTextOf({ value: fields['delegation'], max: FIELD_CHARS });
  const raw = fields['text'];
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (delegation === null || text === '') {
    return invalid({ reason: 'a message block needs "delegation" and "text"' });
  }
  if (text.length > AUTO_CHILD_MESSAGE_CHARS) {
    return invalid({
      reason: `a message holds at most ${AUTO_CHILD_MESSAGE_CHARS.toLocaleString('en-US')} characters. Shorten it, or continue the agent with "retryOf" and a "task" once it is done`,
    });
  }
  return { kind: 'block', block: { action: 'message', delegation, text } };
};

const stopOf = ({ fields }: FieldsParams): AutoBlockOutcome => {
  const delegation = clippedTextOf({ value: fields['delegation'], max: FIELD_CHARS });
  const reason = clippedTextOf({ value: fields['reason'], max: FIELD_CHARS });
  if (delegation === null || reason === null) {
    return invalid({ reason: 'a stop block needs "delegation" and "reason"' });
  }
  return { kind: 'block', block: { action: 'stop', delegation, reason } };
};

export const AUTO_CLOSE_SHAPE = `{"action":"close","target":"<delegation id or artifact id>","as":"${AUTO_CLOSE_AS.join('|')}","reason":"<one line>"}`;

const closeOf = ({ fields }: FieldsParams): AutoBlockOutcome => {
  const target = clippedTextOf({
    value: fields['target'] ?? fields['delegation'] ?? fields['artifact'],
    max: FIELD_CHARS,
  });
  const reason = clippedTextOf({ value: fields['reason'], max: FIELD_CHARS });
  const as = AUTO_CLOSE_AS.find((candidate) => candidate === fields['as']);
  if (target === null || reason === null || as === undefined) {
    return invalid({ reason: `write a close block as ${AUTO_CLOSE_SHAPE}` });
  }
  return { kind: 'block', block: { action: 'close', target, as, reason } };
};

const finishOf = ({ fields }: FieldsParams): AutoBlockOutcome => {
  const summary = clippedTextOf({ value: fields['summary'], max: SUMMARY_CHARS });
  if (summary === null) {
    return invalid({ reason: 'a finish block needs a "summary"' });
  }
  return { kind: 'block', block: { action: 'finish', summary } };
};

const followOf = ({ fields }: FieldsParams): AutoBlockOutcome => {
  const check = clippedTextOf({ value: fields['check'], max: FIELD_CHARS });
  if (check === null) {
    return invalid({ reason: `write a follow block as ${GUIDE_FOLLOW_SHAPE}` });
  }
  return { kind: 'block', block: { action: 'follow', check } };
};

const holdBlockOf = ({ fields }: FieldsParams): AutoBlockOutcome => {
  const reason = clippedTextOf({ value: fields['reason'], max: FIELD_CHARS });
  if (reason === null) {
    return invalid({ reason: `write a hold block as ${GUIDE_HOLD_SHAPE}` });
  }
  return {
    kind: 'block',
    block: {
      action: 'hold',
      reason,
      suggest: clippedTextOf({ value: fields['suggest'], max: FIELD_CHARS }),
    },
  };
};

const deviateOf = ({ fields }: FieldsParams): AutoBlockOutcome => {
  const change = GUIDE_CHANGES.find((candidate) => candidate === fields['change']);
  const step = clippedTextOf({ value: fields['step'], max: FIELD_CHARS });
  const reason = clippedTextOf({ value: fields['reason'], max: FIELD_CHARS });
  if (change === undefined || step === null || reason === null) {
    return invalid({ reason: `write a deviate block as ${GUIDE_DEVIATE_SHAPE}` });
  }
  return { kind: 'block', block: { action: 'deviate', change, step, reason } };
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
    case 'propose':
      return proposeOf({ fields: parsed });
    case 'mount':
      return mountOf({ fields: parsed });
    case 'answer':
      return answerOf({ fields: parsed });
    case 'release':
      return releaseOf({ fields: parsed });
    case 'message':
      return childMessageOf({ fields: parsed });
    case 'stop':
      return stopOf({ fields: parsed });
    case 'close':
      return closeOf({ fields: parsed });
    case 'finish':
      return finishOf({ fields: parsed });
    case 'follow':
      return followOf({ fields: parsed });
    case 'hold':
      return holdBlockOf({ fields: parsed });
    case 'deviate':
      return deviateOf({ fields: parsed });
    default:
      return invalid({
        reason: `"action" must be one of ${AUTO_BLOCK_ACTIONS.join(', ')}`,
      });
  }
};

const completeSlices = ({ text }: BlockSliceParams): ReadonlyArray<string> => {
  const slices: string[] = [];
  let from = 0;
  for (;;) {
    const start = text.indexOf(AUTO_BLOCK_OPEN, from);
    if (start < 0) {
      return slices;
    }
    const contentStart = start + AUTO_BLOCK_OPEN.length;
    const end = text.indexOf(AUTO_BLOCK_CLOSE, contentStart);
    if (end < 0) {
      return slices;
    }
    slices.push(text.slice(contentStart, end));
    from = end + AUTO_BLOCK_CLOSE.length;
  }
};

export const parseAutoCloseBlocks = ({
  text,
}: ParseAutoBlockParams): ReadonlyArray<AutoBlockOutcome> =>
  completeSlices({ text })
    .slice(0, -1)
    .flatMap((slice): ReadonlyArray<AutoBlockOutcome> => {
      const parsed = parseJson({ value: slice });
      return isRecord(parsed) && parsed['action'] === 'close' ? [closeOf({ fields: parsed })] : [];
    });

export const parseAutoNoteBlocks = ({
  text,
}: ParseAutoBlockParams): ReadonlyArray<AutoBlockOutcome> =>
  completeSlices({ text })
    .slice(0, -1)
    .flatMap((slice): ReadonlyArray<AutoBlockOutcome> => {
      const parsed = parseJson({ value: slice });
      if (!isRecord(parsed)) {
        return [];
      }
      if (parsed['action'] === 'follow') {
        return [followOf({ fields: parsed })];
      }
      return parsed['action'] === 'deviate' ? [deviateOf({ fields: parsed })] : [];
    });
