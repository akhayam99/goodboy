import { sha256Hex } from '../slug/sha256';
import { AUTO_FACTS_MOUNTS_MAX } from './limits';
import { parseDelegatePublish, type DelegatePublish } from './publish';
import type { AutoRefusalCode } from './refusals';
import { parseAutoDelegationRole, type AutoDelegationRole } from './roles';
import { clippedTextOf, isRecord } from '@goodboy/types/helpers';

export const DELEGATE_TASK_CHARS = 8_000;
export const DELEGATE_FIELD_CHARS = 1_000;
export const DELEGATE_REASON_CHARS = 240;
export const DELEGATE_LIST_MAX = 8;
export const DELEGATE_TITLE_WORDS = 8;

export type DelegateRevise = Readonly<{
  artifactId: string;
  expectedRevision: number;
}>;

export type DelegateChildSpec = Readonly<{
  role: AutoDelegationRole | null;
  title: string | null;
  task: string;
  reason: string;
  roleReason: string | null;
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
  publish: DelegatePublish | null;
  facts: ReadonlyArray<string>;
  decisions: ReadonlyArray<string>;
  forQuestion: string | null;
  retryOf: string | null;
  replaces: string | null;
  shouldConfirm: boolean;
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

type TitleParams = {
  readonly value: unknown;
};

const titleOf = ({ value }: TitleParams): string | null => {
  const text = clippedTextOf({ value, max: DELEGATE_FIELD_CHARS });
  if (text === null) {
    return null;
  }
  return text.split(/\s+/).slice(0, DELEGATE_TITLE_WORDS).join(' ');
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
    const text = clippedTextOf({ value: entry, max: DELEGATE_FIELD_CHARS });
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
  const artifactId = clippedTextOf({ value: value['artifactId'], max: DELEGATE_FIELD_CHARS });
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
  'title',
  'doneWhen',
  'expected',
  'artifacts',
  'mount',
  'revises',
  'changeFrom',
  'publish',
  'facts',
  'decisions',
  'forQuestion',
  'taskType',
  'difficulty',
  'replaces',
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
      message: `child ${slot + 1}: a retry continues the same agent in its role and worktree, so ${clash} cannot be set. Put new instructions in "task", drop "${clash}", or drop "retryOf"`,
    });
  }
  const task = clippedTextOf({ value: raw['task'], max: DELEGATE_TASK_CHARS });
  const reason = clippedTextOf({ value: raw['reason'], max: DELEGATE_REASON_CHARS });
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
      title: null,
      task: task ?? '',
      reason,
      roleReason: null,
      provider: clippedTextOf({ value: raw['provider'], max: DELEGATE_FIELD_CHARS }),
      model: clippedTextOf({ value: raw['model'], max: DELEGATE_FIELD_CHARS }),
      effort: clippedTextOf({ value: raw['effort'], max: DELEGATE_FIELD_CHARS }),
      taskType: null,
      difficulty: null,
      doneWhen: null,
      expected: null,
      artifactIds: [],
      mount: null,
      revises: null,
      changeFrom: [],
      publish: null,
      facts: [],
      decisions: [],
      forQuestion: null,
      retryOf,
      replaces: null,
      shouldConfirm: raw['confirm'] === true,
    },
  };
};

const parseChild = ({ raw, slot }: ChildParams): ChildOutcome => {
  if (!isRecord(raw)) {
    return refuse({ slot, code: 'spec_invalid', message: `child ${slot + 1} is not an object` });
  }
  if (raw['confirm'] !== undefined && typeof raw['confirm'] !== 'boolean') {
    return refuse({
      slot,
      code: 'spec_invalid',
      message: `child ${slot + 1}: confirm must be a boolean`,
    });
  }
  const revises = reviseOf({ value: raw['revises'] });
  if (revises === 'invalid') {
    return refuse({
      slot,
      code: 'spec_invalid',
      message: `child ${slot + 1}: revises needs artifactId and expectedRevision`,
    });
  }
  const retryOf = clippedTextOf({ value: raw['retryOf'], max: DELEGATE_FIELD_CHARS });
  if (retryOf !== null) {
    return retryChild({ raw, slot, retryOf });
  }
  const publish = parseDelegatePublish({ value: raw['publish'] });
  if (publish === 'invalid') {
    return refuse({
      slot,
      code: 'spec_invalid',
      message: `child ${slot + 1}: publish needs a mode of push or force`,
    });
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
  const task = clippedTextOf({ value: raw['task'], max: DELEGATE_TASK_CHARS });
  if (revises === null && task === null) {
    return refuse({ slot, code: 'spec_invalid', message: `child ${slot + 1} needs a task` });
  }
  const reason = clippedTextOf({ value: raw['reason'], max: DELEGATE_REASON_CHARS });
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
      title: titleOf({ value: raw['title'] }),
      task: task ?? '',
      reason,
      roleReason: clippedTextOf({ value: raw['roleReason'], max: DELEGATE_REASON_CHARS }),
      provider: clippedTextOf({ value: raw['provider'], max: DELEGATE_FIELD_CHARS }),
      model: clippedTextOf({ value: raw['model'], max: DELEGATE_FIELD_CHARS }),
      effort: clippedTextOf({ value: raw['effort'], max: DELEGATE_FIELD_CHARS }),
      taskType: clippedTextOf({ value: raw['taskType'], max: DELEGATE_FIELD_CHARS }),
      difficulty: clippedTextOf({ value: raw['difficulty'], max: DELEGATE_FIELD_CHARS }),
      doneWhen: clippedTextOf({ value: raw['doneWhen'], max: DELEGATE_FIELD_CHARS }),
      expected: clippedTextOf({ value: raw['expected'], max: DELEGATE_FIELD_CHARS }),
      artifactIds: listOf({ value: raw['artifacts'] }),
      mount: clippedTextOf({ value: raw['mount'], max: DELEGATE_FIELD_CHARS }),
      revises,
      changeFrom: listOf({ value: raw['changeFrom'] }),
      publish,
      facts: listOf({ value: raw['facts'] }).slice(0, AUTO_FACTS_MOUNTS_MAX),
      decisions: listOf({ value: raw['decisions'] }),
      forQuestion: clippedTextOf({ value: raw['forQuestion'], max: DELEGATE_FIELD_CHARS }),
      retryOf: null,
      replaces: clippedTextOf({ value: raw['replaces'], max: DELEGATE_FIELD_CHARS }),
      shouldConfirm: raw['confirm'] === true,
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
        child.publish === null
          ? null
          : [child.publish.mode, child.publish.reviewerReportId, child.publish.isContentChanging],
        child.retryOf,
        ...(child.facts.length > 0 ? [child.facts] : []),
        ...(child.decisions.length > 0 ? [child.decisions] : []),
        ...(child.forQuestion === null ? [] : [['forQuestion', child.forQuestion]]),
        ...(child.title === null ? [] : [['title', child.title]]),
        ...(child.replaces === null ? [] : [['replaces', child.replaces]]),
        ...(child.roleReason === null ? [] : [['roleReason', child.roleReason]]),
        ...(child.shouldConfirm ? [['confirm', true]] : []),
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
