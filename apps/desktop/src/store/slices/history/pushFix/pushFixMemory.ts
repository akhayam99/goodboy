import {
  brandId,
  type AgentId,
  type MountId,
  type ProjectId,
  type SessionId,
} from '@goodboy/types';
import { persistedPref, STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import type {
  BranchPushFix,
  HistoryIdentity,
  PushFixFollowUp,
  PushFixOutcome,
  PushFixOutcomeKind,
} from '../types';

export type PushFixMemory = {
  readonly fixes: Readonly<Record<AgentId, BranchPushFix>>;
  readonly outcomes: Readonly<Record<MountId, PushFixOutcome>>;
};

type FieldsParams = {
  readonly value: unknown;
};

type FieldParams = {
  readonly fields: Readonly<Record<string, unknown>>;
  readonly key: string;
};

type FreshParams = {
  readonly at: number;
  readonly now: number;
};

type MemoryParams = {
  readonly stored: unknown;
  readonly now: number;
};

const EMPTY: PushFixMemory = { fixes: {}, outcomes: {} };
const KEPT_MS = 6 * 60 * 60 * 1000;
const OUTCOME_KINDS: ReadonlyArray<PushFixOutcomeKind> = ['pushed', 'agent_failed', 'push_failed'];

const fieldsOf = ({ value }: FieldsParams): Readonly<Record<string, unknown>> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;

const fieldTextOf = ({ fields, key }: FieldParams): string | null => {
  const value = fields[key];
  return typeof value === 'string' ? value : null;
};

const numberOf = ({ fields, key }: FieldParams): number | null => {
  const value = fields[key];
  return typeof value === 'number' ? value : null;
};

const flagOf = ({ fields, key }: FieldParams): boolean | null => {
  const value = fields[key];
  return typeof value === 'boolean' ? value : null;
};

const textOrNullOf = ({ fields, key }: FieldParams): string | null | undefined => {
  const value = fields[key];
  if (value === null) {
    return null;
  }
  return typeof value === 'string' ? value : undefined;
};

const textListOf = ({ fields, key }: FieldParams): ReadonlyArray<string> | null | undefined => {
  const value = fields[key];
  if (value === null) {
    return null;
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  const texts = value.flatMap((entry) => (typeof entry === 'string' ? [entry] : []));
  return texts.length === value.length ? texts : undefined;
};

const identityOf = ({ value }: FieldsParams): HistoryIdentity | null => {
  const fields = fieldsOf({ value });
  if (fields === null) {
    return null;
  }
  const worktreePath = fieldTextOf({ fields, key: 'worktreePath' });
  const branch = fieldTextOf({ fields, key: 'branch' });
  const projectId = fieldTextOf({ fields, key: 'projectId' });
  if (worktreePath === null || branch === null || projectId === null) {
    return null;
  }
  return { worktreePath, branch, projectId: brandId<ProjectId>({ value: projectId }) };
};

const followUpOf = ({ value }: FieldsParams): PushFixFollowUp | null | undefined => {
  if (value === null) {
    return null;
  }
  const fields = fieldsOf({ value });
  const sentence = fields === null ? null : fieldTextOf({ fields, key: 'sentence' });
  const tone = fields === null ? null : fields.tone;
  if (sentence === null || (tone !== 'done' && tone !== 'failed')) {
    return undefined;
  }
  return { tone, sentence };
};

const fixOf = ({ value }: FieldsParams): BranchPushFix | null => {
  const fields = fieldsOf({ value });
  if (fields === null) {
    return null;
  }
  const agentId = fieldTextOf({ fields, key: 'agentId' });
  const sessionId = fieldTextOf({ fields, key: 'sessionId' });
  const mountId = fieldTextOf({ fields, key: 'mountId' });
  const isForce = flagOf({ fields, key: 'isForce' });
  const startedAt = numberOf({ fields, key: 'startedAt' });
  const identity = identityOf({ value: fields.identity });
  const confirmedRemoteSha = textOrNullOf({ fields, key: 'confirmedRemoteSha' });
  const confirmedOnlyOnline = textListOf({ fields, key: 'confirmedOnlyOnline' });
  if (
    agentId === null ||
    sessionId === null ||
    mountId === null ||
    isForce === null ||
    startedAt === null ||
    identity === null ||
    confirmedRemoteSha === undefined ||
    confirmedOnlyOnline === undefined
  ) {
    return null;
  }
  return {
    agentId: brandId<AgentId>({ value: agentId }),
    sessionId: brandId<SessionId>({ value: sessionId }),
    mountId: brandId<MountId>({ value: mountId }),
    identity,
    isForce,
    confirmedOnlyOnline,
    confirmedRemoteSha,
    startedAt,
  };
};

const storedOutcomeOf = ({ value }: FieldsParams): PushFixOutcome | null => {
  const fields = fieldsOf({ value });
  if (fields === null) {
    return null;
  }
  const agentId = fieldTextOf({ fields, key: 'agentId' });
  const sessionId = fieldTextOf({ fields, key: 'sessionId' });
  const mountId = fieldTextOf({ fields, key: 'mountId' });
  const kind = OUTCOME_KINDS.find((candidate) => candidate === fields.kind);
  const reason = textOrNullOf({ fields, key: 'reason' });
  const settledAt = numberOf({ fields, key: 'settledAt' });
  const isClaimed = flagOf({ fields, key: 'isClaimed' });
  const followUp = followUpOf({ value: fields.followUp });
  if (
    agentId === null ||
    sessionId === null ||
    mountId === null ||
    kind === undefined ||
    reason === undefined ||
    settledAt === null ||
    isClaimed === null ||
    followUp === undefined
  ) {
    return null;
  }
  return {
    agentId: brandId<AgentId>({ value: agentId }),
    sessionId: brandId<SessionId>({ value: sessionId }),
    mountId: brandId<MountId>({ value: mountId }),
    kind,
    reason,
    settledAt,
    isClaimed,
    followUp,
  };
};

const isFresh = ({ at, now }: FreshParams): boolean => now - at < KEPT_MS;

const memoryFrom = ({ stored: value, now }: MemoryParams): PushFixMemory => {
  const stored = fieldsOf({ value });
  if (stored === null) {
    return EMPTY;
  }
  const fixes: Record<AgentId, BranchPushFix> = {};
  const outcomes: Record<MountId, PushFixOutcome> = {};
  for (const candidate of Object.values(fieldsOf({ value: stored.fixes }) ?? {})) {
    const fix = fixOf({ value: candidate });
    if (fix !== null && isFresh({ at: fix.startedAt, now })) {
      fixes[fix.agentId] = fix;
    }
  }
  for (const candidate of Object.values(fieldsOf({ value: stored.outcomes }) ?? {})) {
    const outcome = storedOutcomeOf({ value: candidate });
    if (outcome !== null && isFresh({ at: outcome.settledAt, now })) {
      outcomes[outcome.mountId] = outcome;
    }
  }
  return { fixes, outcomes };
};

const memoryPref = () =>
  persistedPref<unknown>({ key: STORAGE_KEYS.pushFixes, fallback: null, parse: JSON.parse });

export const readPushFixMemory = (): PushFixMemory =>
  memoryFrom({ stored: memoryPref().read(), now: Date.now() });

type WriteParams = PushFixMemory;

export const writePushFixMemory = ({ fixes, outcomes }: WriteParams): void => {
  if (Object.keys(fixes).length === 0 && Object.keys(outcomes).length === 0) {
    memoryPref().clear();
    return;
  }
  memoryPref().write({ fixes, outcomes });
};
