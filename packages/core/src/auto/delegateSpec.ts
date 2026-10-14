import { sha256Hex } from '../slug/sha256';
import type { AutoRefusalCode } from './refusals';
import { parseAutoDelegationRole, type AutoDelegationRole } from './roles';

export const DELEGATE_TASK_CHARS = 8_000;
export const DELEGATE_FIELD_CHARS = 1_000;
export const DELEGATE_REASON_CHARS = 240;
export const DELEGATE_LIST_MAX = 8;

export type DelegateRevise = Readonly<{
  artifactId: string;
  expectedRevision: number;
}>;

export type DelegateChildSpec = Readonly<{
  role: AutoDelegationRole | null;
  task: string;
  reason: string;
  provider: string | null;
  model: string | null;
  effort: string | null;
  taskType: string | null;
  difficulty: string | null;
  doneWhen: string | null;
  expected: string | null;
  artifactIds: ReadonlyArray<string>;
  mount: string | null;
  revises: DelegateRevise | null;
  changeFrom: ReadonlyArray<string>;
  retryOf: string | null;
}>;

export type DelegateChildRefusal = Readonly<{
  slot: number;
  code: AutoRefusalCode;
  message: string;
}>;

export type DelegateSpecOutcome =
  | Readonly<{ kind: 'ok'; children: ReadonlyArray<DelegateChildSpec>; hash: string }>
  | Readonly<{
      kind: 'refused';
      code: AutoRefusalCode;
      message: string;
      perChild: ReadonlyArray<DelegateChildRefusal>;
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

type ListParams = {
  readonly value: unknown;
};

const listOf = ({ value }: ListParams): ReadonlyArray<string> => {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  for (const entry of value) {
    const text = textOf({ value: entry, max: DELEGATE_FIELD_CHARS });
    if (text !== null && !out.includes(text)) {
      out.push(text);
    }
  }
  return out.slice(0, DELEGATE_LIST_MAX);
};

type ReviseParams = {
  readonly value: unknown;
};

const reviseOf = ({ value }: ReviseParams): DelegateRevise | null | 'invalid' => {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isRecord(value)) {
    return 'invalid';
  }
  const artifactId = textOf({ value: value['artifactId'], max: DELEGATE_FIELD_CHARS });
  const revision = value['expectedRevision'];
  if (artifactId === null || typeof revision !== 'number' || !Number.isInteger(revision)) {
    return 'invalid';
  }
  return revision >= 1 ? { artifactId, expectedRevision: revision } : 'invalid';
};

type ChildParams = {
  readonly raw: unknown;
  readonly slot: number;
};

type ChildOutcome =
  | Readonly<{ kind: 'ok'; child: DelegateChildSpec }>
  | Readonly<{ kind: 'refused'; refusal: DelegateChildRefusal }>;

const refuse = ({ slot, code, message }: DelegateChildRefusal): ChildOutcome => ({
  kind: 'refused',
  refusal: { slot, code, message },
});

const RETRY_EXCLUSIVE_KEYS = [
  'role',
  'task',
  'doneWhen',
  'expected',
  'artifacts',
  'mount',
  'revises',
  'changeFrom',
  'taskType',
  'difficulty',
] as const;

type RetryChildParams = {
  readonly raw: RecordValue;
  readonly slot: number;
  readonly retryOf: string;
};

const retryChild = ({ raw, slot, retryOf }: RetryChildParams): ChildOutcome => {
  const clash = RETRY_EXCLUSIVE_KEYS.find((key) => {
    const value = raw[key];
    return value !== undefined && value !== null && value !== '';
  });
  if (clash !== undefined) {
    return refuse({
      slot,
      code: 'spec_invalid',
      message: `child ${slot + 1}: a retry repeats the earlier work as it was, so ${clash} cannot be set`,
    });
  }
  const reason = textOf({ value: raw['reason'], max: DELEGATE_REASON_CHARS });
  if (reason === null) {
    return refuse({
      slot,
      code: 'spec_invalid',
      message: `child ${slot + 1} needs a reason for the retry`,
    });
  }
  return {
    kind: 'ok',
    child: {
      role: null,
      task: '',
      reason,
      provider: textOf({ value: raw['provider'], max: DELEGATE_FIELD_CHARS }),
      model: textOf({ value: raw['model'], max: DELEGATE_FIELD_CHARS }),
      effort: textOf({ value: raw['effort'], max: DELEGATE_FIELD_CHARS }),
      taskType: null,
      difficulty: null,
      doneWhen: null,
      expected: null,
      artifactIds: [],
      mount: null,
      revises: null,
      changeFrom: [],
      retryOf,
    },
  };
};

const parseChild = ({ raw, slot }: ChildParams): ChildOutcome => {
  if (!isRecord(raw)) {
    return refuse({ slot, code: 'spec_invalid', message: `child ${slot + 1} is not an object` });
  }
  const revises = reviseOf({ value: raw['revises'] });
  if (revises === 'invalid') {
    return refuse({
      slot,
      code: 'spec_invalid',
      message: `child ${slot + 1}: revises needs artifactId and expectedRevision`,
    });
  }
  const retryOf = textOf({ value: raw['retryOf'], max: DELEGATE_FIELD_CHARS });
  if (retryOf !== null) {
    return retryChild({ raw, slot, retryOf });
  }
  const rawRole = raw['role'];
  const role = parseAutoDelegationRole({ role: rawRole });
  const hasRole = rawRole !== undefined && rawRole !== null && rawRole !== '';
  if (hasRole && role === null) {
    return refuse({
      slot,
      code: 'role_unknown',
      message: `child ${slot + 1}: ${String(rawRole)} is not a role you can hand work to`,
    });
  }
  if (revises === null && role === null) {
    return refuse({ slot, code: 'spec_invalid', message: `child ${slot + 1} needs a role` });
  }
  const task = textOf({ value: raw['task'], max: DELEGATE_TASK_CHARS });
  if (revises === null && task === null) {
    return refuse({ slot, code: 'spec_invalid', message: `child ${slot + 1} needs a task` });
  }
  const reason = textOf({ value: raw['reason'], max: DELEGATE_REASON_CHARS });
  if (reason === null) {
    return refuse({
      slot,
      code: 'spec_invalid',
      message: `child ${slot + 1} needs a reason for its role`,
    });
  }
  return {
    kind: 'ok',
    child: {
      role,
      task: task ?? '',
      reason,
      provider: textOf({ value: raw['provider'], max: DELEGATE_FIELD_CHARS }),
      model: textOf({ value: raw['model'], max: DELEGATE_FIELD_CHARS }),
      effort: textOf({ value: raw['effort'], max: DELEGATE_FIELD_CHARS }),
      taskType: textOf({ value: raw['taskType'], max: DELEGATE_FIELD_CHARS }),
      difficulty: textOf({ value: raw['difficulty'], max: DELEGATE_FIELD_CHARS }),
      doneWhen: textOf({ value: raw['doneWhen'], max: DELEGATE_FIELD_CHARS }),
      expected: textOf({ value: raw['expected'], max: DELEGATE_FIELD_CHARS }),
      artifactIds: listOf({ value: raw['artifacts'] }),
      mount: textOf({ value: raw['mount'], max: DELEGATE_FIELD_CHARS }),
      revises,
      changeFrom: listOf({ value: raw['changeFrom'] }),
      retryOf: null,
    },
  };
};

type JsonParams = {
  readonly text: string;
};

const parseJson = ({ text }: JsonParams): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const childrenOf = ({ value }: ListParams): ReadonlyArray<unknown> | null => {
  if (Array.isArray(value)) {
    return value;
  }
  if (isRecord(value) && Array.isArray(value['children'])) {
    return value['children'];
  }
  return null;
};

type HashParams = {
  readonly children: ReadonlyArray<DelegateChildSpec>;
};

export const hashDelegateChildren = ({ children }: HashParams): string =>
  sha256Hex(
    JSON.stringify(
      children.map((child) => [
        child.role,
        child.task,
        child.reason,
        child.provider,
        child.model,
        child.effort,
        child.taskType,
        child.difficulty,
        child.doneWhen,
        child.expected,
        child.artifactIds,
        child.mount,
        child.revises === null ? null : [child.revises.artifactId, child.revises.expectedRevision],
        child.changeFrom,
        child.retryOf,
      ]),
    ),
  );

export const parseDelegateSpec = ({ text }: JsonParams): DelegateSpecOutcome => {
  const parsed = parseJson({ text });
  const entries = childrenOf({ value: parsed });
  if (entries === null) {
    return {
      kind: 'refused',
      code: 'spec_invalid',
      message: 'the spec is not a JSON object with a children list',
      perChild: [],
    };
  }
  const children: DelegateChildSpec[] = [];
  const perChild: DelegateChildRefusal[] = [];
  for (const [slot, raw] of entries.entries()) {
    const outcome = parseChild({ raw, slot });
    if (outcome.kind === 'ok') {
      children.push(outcome.child);
      continue;
    }
    perChild.push(outcome.refusal);
  }
  const first = perChild[0];
  if (first !== undefined) {
    return { kind: 'refused', code: first.code, message: first.message, perChild };
  }
  return { kind: 'ok', children, hash: hashDelegateChildren({ children }) };
};
