import type { DecisionOp } from '../context/decisions-ledger';

export type SummarizerDecisionOp = Exclude<DecisionOp, { readonly kind: 'restore' }>;

export type DecisionOpsParse =
  | { readonly kind: 'ok'; readonly ops: ReadonlyArray<SummarizerDecisionOp> }
  | { readonly kind: 'invalid'; readonly message: string };

const ID_PATTERN = /^\s*D?(\d+)\s*$/i;

type ValueParams = {
  readonly value: unknown;
};

const idOf = ({ value }: ValueParams): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const match = ID_PATTERN.exec(value);
  return match === null ? null : Number(match[1]);
};

const textOf = ({ value }: ValueParams): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type EntryOutcome =
  | { readonly kind: 'op'; readonly op: SummarizerDecisionOp }
  | { readonly kind: 'skip' }
  | { readonly kind: 'invalid'; readonly message: string };

const invalid = (message: string): EntryOutcome => ({ kind: 'invalid', message });

const entryOf = ({ value }: ValueParams): EntryOutcome => {
  if (!isRecord(value)) {
    return invalid('a decision operation was not an object');
  }
  const op = value.op;
  const text = textOf({ value: value.text });
  const reason = textOf({ value: value.reason });
  switch (op) {
    case 'add': {
      if (text === null) {
        return invalid('add without text');
      }
      const why = textOf({ value: value.why });
      if (why === null) {
        return { kind: 'skip' };
      }
      return { kind: 'op', op: { kind: 'add', text, why } };
    }
    case 'reword': {
      const number = idOf({ value: value.id });
      if (number === null || text === null) {
        return invalid('reword needs an id and text');
      }
      return { kind: 'op', op: { kind: 'reword', number, text } };
    }
    case 'merge': {
      const ids = Array.isArray(value.ids) ? value.ids.map((id) => idOf({ value: id })) : [];
      const numbers = ids.filter((id): id is number => id !== null);
      if (numbers.length < 2 || numbers.length !== ids.length || text === null) {
        return invalid('merge needs two or more ids and text');
      }
      return { kind: 'op', op: { kind: 'merge', numbers, text } };
    }
    case 'replace': {
      const number = idOf({ value: value.id });
      if (number === null || text === null) {
        return invalid('replace needs an id and text');
      }
      return { kind: 'op', op: { kind: 'replace', number, text, reason } };
    }
    case 'withdraw': {
      const number = idOf({ value: value.id });
      if (number === null) {
        return invalid('withdraw needs an id');
      }
      return { kind: 'op', op: { kind: 'withdraw', number, reason } };
    }
    default:
      return invalid(`unknown decision operation ${JSON.stringify(op)}`);
  }
};

export const parseDecisionOps = ({ value }: ValueParams): DecisionOpsParse => {
  if (value === undefined || value === null) {
    return { kind: 'ok', ops: [] };
  }
  if (!Array.isArray(value)) {
    return { kind: 'invalid', message: '"decisionOps" was not an array' };
  }
  const ops: SummarizerDecisionOp[] = [];
  for (const entry of value) {
    const outcome = entryOf({ value: entry });
    if (outcome.kind === 'invalid') {
      return { kind: 'invalid', message: outcome.message };
    }
    if (outcome.kind === 'op') {
      ops.push(outcome.op);
    }
  }
  return { kind: 'ok', ops };
};
