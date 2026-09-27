import type {
  AgentId,
  IsoDateTime,
  SessionDecision,
  SessionDecisionAuthor,
  SessionDecisionChange,
  SessionId,
} from '@goodboy/types';
import { SLOT_BUDGETS } from './budgets';
import { parseDecisions } from './decisions-document';

export type DecisionOp =
  | { readonly kind: 'add'; readonly text: string }
  | { readonly kind: 'reword'; readonly number: number; readonly text: string }
  | { readonly kind: 'merge'; readonly numbers: ReadonlyArray<number>; readonly text: string }
  | {
      readonly kind: 'replace';
      readonly number: number;
      readonly text: string;
      readonly reason: string | null;
    }
  | { readonly kind: 'withdraw'; readonly number: number; readonly reason: string | null }
  | { readonly kind: 'restore'; readonly number: number };

export type DecisionActor = {
  readonly author: SessionDecisionAuthor;
  readonly agentId: AgentId | null;
  readonly turnOrdinal: number | null;
};

export type DecisionChange = SessionDecisionChange;

export type DecisionChangeCounts = {
  readonly added: number;
  readonly replaced: number;
  readonly withdrawn: number;
  readonly merged: number;
  readonly restored: number;
};

type ChangesParams = {
  readonly changes: ReadonlyArray<DecisionChange>;
};

const countOf = ({
  changes,
  kind,
}: ChangesParams & { readonly kind: DecisionChange['kind'] }): number =>
  changes.filter((change) => change.kind === kind).length;

export const countDecisionChanges = ({ changes }: ChangesParams): DecisionChangeCounts => ({
  added: countOf({ changes, kind: 'added' }),
  replaced: countOf({ changes, kind: 'replaced' }),
  withdrawn: countOf({ changes, kind: 'withdrawn' }),
  merged: countOf({ changes, kind: 'merged' }),
  restored: countOf({ changes, kind: 'restored' }),
});

export const hasVisibleDecisionChange = ({ changes }: ChangesParams): boolean =>
  changes.some((change) => change.kind !== 'reworded');

export type DecisionRejectionReason =
  | 'empty'
  | 'duplicate'
  | 'tomb'
  | 'unknown-decision'
  | 'not-active'
  | 'not-withdrawn'
  | 'needs-reason'
  | 'user-owned'
  | 'user-only';

export type DecisionRejection = {
  readonly op: DecisionOp;
  readonly reason: DecisionRejectionReason;
};

export type ApplyDecisionOpsResult = {
  readonly ledger: ReadonlyArray<SessionDecision>;
  readonly changes: ReadonlyArray<DecisionChange>;
  readonly rejected: ReadonlyArray<DecisionRejection>;
  readonly touched: ReadonlyArray<SessionDecision>;
};

type ApplyParams = {
  readonly sessionId: SessionId;
  readonly ledger: ReadonlyArray<SessionDecision>;
  readonly ops: ReadonlyArray<DecisionOp>;
  readonly actor: DecisionActor;
  readonly now: IsoDateTime;
  readonly newId: () => string;
};

const NUMBER_PREFIX = /^D(\d+)[ \t]+/;
const BULLET_PREFIX = /^\s*(?:[-*+]|\d+[.)])\s+/;
const TRAILING_PUNCTUATION = new Set(['.', ';', ':', '!']);

type TextParams = {
  readonly text: string;
};

const stripTrailingPunctuation = (text: string): string => {
  let end = text.length;
  while (end > 0 && TRAILING_PUNCTUATION.has(text.charAt(end - 1))) {
    end -= 1;
  }
  return text.slice(0, end);
};

export const normalizeDecisionText = ({ text }: TextParams): string =>
  stripTrailingPunctuation(
    text
      .replace(BULLET_PREFIX, '')
      .replace(NUMBER_PREFIX, '')
      .toLowerCase()
      .replace(/[`*_]/g, '')
      .replace(/\s+/g, ' '),
  ).trim();

const cleanText = ({ text }: TextParams): string => text.replace(NUMBER_PREFIX, '').trim();

const hasReason = (reason: string | null): reason is string =>
  reason !== null && reason.trim() !== '';

type MutableLedger = Map<number, SessionDecision>;

type OpParams<K extends DecisionOp['kind']> = {
  readonly op: Extract<DecisionOp, { kind: K }>;
  readonly rows: MutableLedger;
  readonly params: ApplyParams;
};

type OpOutcome =
  | { readonly kind: 'applied'; readonly changes: ReadonlyArray<DecisionChange> }
  | { readonly kind: 'rejected'; readonly reason: DecisionRejectionReason };

const rejected = (reason: DecisionRejectionReason): OpOutcome => ({ kind: 'rejected', reason });

const nextNumber = ({ rows }: { readonly rows: MutableLedger }): number =>
  Math.max(0, ...rows.keys()) + 1;

const isSummarizerOnUserRow = ({
  row,
  actor,
}: {
  readonly row: SessionDecision;
  readonly actor: DecisionActor;
}): boolean => actor.author === 'summarizer' && row.author === 'user';

const insertRow = ({
  rows,
  params,
  text,
}: {
  readonly rows: MutableLedger;
  readonly params: ApplyParams;
  readonly text: string;
}): SessionDecision => {
  const number = nextNumber({ rows });
  const row: SessionDecision = {
    id: params.newId(),
    sessionId: params.sessionId,
    number,
    text,
    status: 'active',
    replacedBy: null,
    author: params.actor.author,
    agentId: params.actor.agentId,
    turnOrdinal: params.actor.turnOrdinal,
    reason: null,
    closedBy: null,
    closedByAgentId: null,
    previousText: null,
    rewordedAt: null,
    createdAt: params.now,
    updatedAt: params.now,
  };
  rows.set(number, row);
  return row;
};

const closeRow = ({
  rows,
  params,
  row,
  status,
  replacedBy,
  reason,
}: {
  readonly rows: MutableLedger;
  readonly params: ApplyParams;
  readonly row: SessionDecision;
  readonly status: 'replaced' | 'withdrawn';
  readonly replacedBy: number | null;
  readonly reason: string | null;
}): void => {
  rows.set(row.number, {
    ...row,
    status,
    replacedBy,
    reason: hasReason(reason) ? reason.trim() : null,
    closedBy: params.actor.author,
    closedByAgentId: params.actor.agentId,
    updatedAt: params.now,
  });
};

const applyAdd = ({ op, rows, params }: OpParams<'add'>): OpOutcome => {
  const text = cleanText({ text: op.text });
  const normalized = normalizeDecisionText({ text });
  if (normalized === '') {
    return rejected('empty');
  }
  const same = [...rows.values()].filter(
    (row) => normalizeDecisionText({ text: row.text }) === normalized,
  );
  if (same.some((row) => row.status === 'active')) {
    return rejected('duplicate');
  }
  const isTomb = same.some((row) => row.status === 'withdrawn' && row.closedBy === 'user');
  if (isTomb && params.actor.author !== 'user') {
    return rejected('tomb');
  }
  const row = insertRow({ rows, params, text });
  return { kind: 'applied', changes: [{ kind: 'added', number: row.number, text }] };
};

const applyReword = ({ op, rows, params }: OpParams<'reword'>): OpOutcome => {
  const row = rows.get(op.number);
  if (row === undefined) {
    return rejected('unknown-decision');
  }
  if (row.status !== 'active') {
    return rejected('not-active');
  }
  if (isSummarizerOnUserRow({ row, actor: params.actor })) {
    return rejected('user-owned');
  }
  const text = cleanText({ text: op.text });
  if (normalizeDecisionText({ text }) === '') {
    return rejected('empty');
  }
  if (text === row.text) {
    return { kind: 'applied', changes: [] };
  }
  const isUser = params.actor.author === 'user';
  rows.set(row.number, {
    ...row,
    text,
    author: isUser ? 'user' : row.author,
    previousText: row.text,
    rewordedAt: isUser ? null : params.now,
    updatedAt: params.now,
  });
  return {
    kind: 'applied',
    changes: [{ kind: 'reworded', number: row.number, text, previousText: row.text }],
  };
};

const applyMerge = ({ op, rows, params }: OpParams<'merge'>): OpOutcome => {
  const numbers = [...new Set(op.numbers)].sort((a, b) => a - b);
  if (numbers.length < 2) {
    return rejected('unknown-decision');
  }
  const targets = numbers.map((number) => rows.get(number));
  if (targets.some((row) => row === undefined)) {
    return rejected('unknown-decision');
  }
  const present = targets.filter((row): row is SessionDecision => row !== undefined);
  if (present.some((row) => row.status !== 'active')) {
    return rejected('not-active');
  }
  if (present.some((row) => isSummarizerOnUserRow({ row, actor: params.actor }))) {
    return rejected('user-owned');
  }
  const text = cleanText({ text: op.text });
  if (normalizeDecisionText({ text }) === '') {
    return rejected('empty');
  }
  const [keep, ...rest] = present;
  if (keep === undefined) {
    return rejected('unknown-decision');
  }
  rows.set(keep.number, {
    ...keep,
    text,
    previousText: keep.text === text ? keep.previousText : keep.text,
    rewordedAt: keep.text === text ? keep.rewordedAt : params.now,
    updatedAt: params.now,
  });
  for (const row of rest) {
    closeRow({ rows, params, row, status: 'replaced', replacedBy: keep.number, reason: null });
  }
  return {
    kind: 'applied',
    changes: rest.map((row) => ({
      kind: 'merged',
      number: row.number,
      into: keep.number,
      text: row.text,
    })),
  };
};

const applyReplace = ({ op, rows, params }: OpParams<'replace'>): OpOutcome => {
  const row = rows.get(op.number);
  if (row === undefined) {
    return rejected('unknown-decision');
  }
  if (row.status !== 'active') {
    return rejected('not-active');
  }
  if (params.actor.author === 'summarizer' && !hasReason(op.reason)) {
    return rejected('needs-reason');
  }
  const text = cleanText({ text: op.text });
  if (normalizeDecisionText({ text }) === '') {
    return rejected('empty');
  }
  const next = insertRow({ rows, params, text });
  closeRow({ rows, params, row, status: 'replaced', replacedBy: next.number, reason: op.reason });
  return {
    kind: 'applied',
    changes: [
      {
        kind: 'replaced',
        number: row.number,
        by: next.number,
        text,
        reason: hasReason(op.reason) ? op.reason.trim() : null,
      },
    ],
  };
};

const applyWithdraw = ({ op, rows, params }: OpParams<'withdraw'>): OpOutcome => {
  const row = rows.get(op.number);
  if (row === undefined) {
    return rejected('unknown-decision');
  }
  if (row.status !== 'active') {
    return rejected('not-active');
  }
  if (isSummarizerOnUserRow({ row, actor: params.actor })) {
    return rejected('user-owned');
  }
  if (params.actor.author !== 'user' && !hasReason(op.reason)) {
    return rejected('needs-reason');
  }
  closeRow({ rows, params, row, status: 'withdrawn', replacedBy: null, reason: op.reason });
  return {
    kind: 'applied',
    changes: [
      {
        kind: 'withdrawn',
        number: row.number,
        text: row.text,
        reason: hasReason(op.reason) ? op.reason.trim() : null,
      },
    ],
  };
};

const applyRestore = ({ op, rows, params }: OpParams<'restore'>): OpOutcome => {
  if (params.actor.author !== 'user') {
    return rejected('user-only');
  }
  const row = rows.get(op.number);
  if (row === undefined) {
    return rejected('unknown-decision');
  }
  if (row.status !== 'withdrawn') {
    return rejected('not-withdrawn');
  }
  rows.set(row.number, {
    ...row,
    status: 'active',
    reason: null,
    closedBy: null,
    closedByAgentId: null,
    updatedAt: params.now,
  });
  return { kind: 'applied', changes: [{ kind: 'restored', number: row.number, text: row.text }] };
};

const applyOne = ({
  op,
  rows,
  params,
}: {
  readonly op: DecisionOp;
  readonly rows: MutableLedger;
  readonly params: ApplyParams;
}): OpOutcome => {
  switch (op.kind) {
    case 'add':
      return applyAdd({ op, rows, params });
    case 'reword':
      return applyReword({ op, rows, params });
    case 'merge':
      return applyMerge({ op, rows, params });
    case 'replace':
      return applyReplace({ op, rows, params });
    case 'withdraw':
      return applyWithdraw({ op, rows, params });
    case 'restore':
      return applyRestore({ op, rows, params });
    default: {
      const unreachable: never = op;
      return unreachable;
    }
  }
};

export const applyDecisionOps = (params: ApplyParams): ApplyDecisionOpsResult => {
  const rows: MutableLedger = new Map(params.ledger.map((row) => [row.number, row]));
  const changes: DecisionChange[] = [];
  const rejections: DecisionRejection[] = [];
  for (const op of params.ops) {
    const outcome = applyOne({ op, rows, params });
    if (outcome.kind === 'rejected') {
      rejections.push({ op, reason: outcome.reason });
      continue;
    }
    changes.push(...outcome.changes);
  }
  const ledger = [...rows.values()].sort((a, b) => a.number - b.number);
  const before = new Map(params.ledger.map((row) => [row.number, row]));
  const touched = ledger.filter((row) => before.get(row.number) !== row);
  return { ledger, changes, rejected: rejections, touched };
};

type LedgerParams = {
  readonly ledger: ReadonlyArray<SessionDecision>;
};

export const activeDecisionsNewestFirst = ({
  ledger,
}: LedgerParams): ReadonlyArray<SessionDecision> =>
  ledger.filter((row) => row.status === 'active').sort((a, b) => b.number - a.number);

export const renderDecisionsSlot = ({ ledger }: LedgerParams): string =>
  activeDecisionsNewestFirst({ ledger })
    .map((row) => {
      const [first = '', ...rest] = row.text.split('\n');
      return [`- D${row.number} ${first}`, ...rest].join('\n');
    })
    .join('\n');

export const isLedgerOverBudget = ({ ledger }: LedgerParams): boolean =>
  renderDecisionsSlot({ ledger }).length > SLOT_BUDGETS.decisions;

type SlotRow = {
  readonly number: number | null;
  readonly text: string;
};

export const readDecisionsSlotRows = ({ text }: TextParams): ReadonlyArray<SlotRow> =>
  parseDecisions({ text })
    .rows.map((row) => {
      const trimmed = row.text.trim();
      const match = NUMBER_PREFIX.exec(trimmed);
      if (match === null) {
        return { number: null, text: trimmed };
      }
      return { number: Number(match[1]), text: trimmed.slice(match[0].length).trim() };
    })
    .filter((row) => row.text !== '');

type SeedParams = {
  readonly sessionId: SessionId;
  readonly text: string;
  readonly now: IsoDateTime;
  readonly newId: () => string;
};

export const seedDecisionLedger = ({
  sessionId,
  text,
  now,
  newId,
}: SeedParams): ReadonlyArray<SessionDecision> =>
  readDecisionsSlotRows({ text }).map((row, index) => ({
    id: newId(),
    sessionId,
    number: index + 1,
    text: row.text,
    status: 'active',
    replacedBy: null,
    author: 'summarizer',
    agentId: null,
    turnOrdinal: null,
    reason: null,
    closedBy: null,
    closedByAgentId: null,
    previousText: null,
    rewordedAt: null,
    createdAt: now,
    updatedAt: now,
  }));

type ReconcileParams = {
  readonly ledger: ReadonlyArray<SessionDecision>;
  readonly text: string;
};

export const reconcileDecisionsText = ({
  ledger,
  text,
}: ReconcileParams): ReadonlyArray<DecisionOp> => {
  const byNumber = new Map(ledger.map((row) => [row.number, row]));
  const matched = new Set<number>();
  const ops: DecisionOp[] = [];
  const unnumbered: SlotRow[] = [];

  for (const row of readDecisionsSlotRows({ text })) {
    const target = row.number === null ? undefined : byNumber.get(row.number);
    if (target === undefined || matched.has(target.number)) {
      unnumbered.push(row);
      continue;
    }
    matched.add(target.number);
    if (target.status !== 'active') {
      ops.push({ kind: 'restore', number: target.number });
    }
    if (row.text !== target.text) {
      ops.push({ kind: 'reword', number: target.number, text: row.text });
    }
  }

  const additions: DecisionOp[] = [];
  for (const row of unnumbered) {
    const normalized = normalizeDecisionText({ text: row.text });
    const same = ledger.find(
      (candidate) =>
        candidate.status === 'active' &&
        !matched.has(candidate.number) &&
        normalizeDecisionText({ text: candidate.text }) === normalized,
    );
    if (same !== undefined) {
      matched.add(same.number);
      continue;
    }
    additions.push({ kind: 'add', text: row.text });
  }
  ops.push(...additions.reverse());

  for (const row of ledger) {
    if (row.status !== 'active' || matched.has(row.number)) {
      continue;
    }
    ops.push({ kind: 'withdraw', number: row.number, reason: null });
  }

  return ops;
};

export const CONSOLIDATION_OP_KINDS: ReadonlySet<DecisionOp['kind']> = new Set([
  'merge',
  'withdraw',
]);
