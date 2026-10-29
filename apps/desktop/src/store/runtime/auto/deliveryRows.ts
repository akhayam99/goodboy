import { storedDeliveryOf } from '@goodboy/core';
import type { AutoOutboxKind, AutoOutboxRow, AutoPhase } from '@goodboy/db';

const KIND_RANK: Readonly<Record<AutoOutboxKind, number>> = {
  results: 0,
  question: 1,
  refusal: 2,
  user: 3,
};

type KindAllowedParams = {
  readonly phase: AutoPhase;
  readonly kind: AutoOutboxKind;
  readonly isIdle: boolean;
};

const isKindAllowed = ({ phase, kind, isIdle }: KindAllowedParams): boolean => {
  switch (phase) {
    case 'answering':
    case 'merging':
    case 'blocked':
    case 'done':
      return true;
    case 'waiting':
      return kind === 'question' || kind === 'refusal' || (isIdle && kind === 'user');
    case 'finished':
      return kind === 'user';
    case 'deciding':
    case 'delegating':
    case 'stopping':
    case 'stopped':
      return false;
    default: {
      const unreachable: never = phase;
      return unreachable;
    }
  }
};

export type ChooseDeliveryRowsParams = Readonly<{
  phase: AutoPhase;
  generation: number;
  pending: ReadonlyArray<AutoOutboxRow>;
  isIdle?: boolean;
  sendNowId?: string | null;
}>;

export const chooseDeliveryRows = ({
  phase,
  generation,
  pending,
  isIdle = false,
  sendNowId = null,
}: ChooseDeliveryRowsParams): ReadonlyArray<AutoOutboxRow> => {
  if (sendNowId !== null && phase === 'waiting') {
    return pending.filter(
      (row) => String(row.id) === sendNowId && row.kind === 'user' && row.generation === generation,
    );
  }
  const eligible = pending
    .filter(
      (row) => row.generation === generation && isKindAllowed({ phase, kind: row.kind, isIdle }),
    )
    .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.createdAt - b.createdAt);
  const primary = eligible[0];
  if (primary === undefined) {
    return [];
  }
  const stored = storedDeliveryOf({ value: primary.payload });
  if (stored === null) {
    return phase === 'waiting' ? [primary] : eligible;
  }
  const byId = new Map(pending.map((row) => [String(row.id), row]));
  const same = stored.rowIds.map((id) => byId.get(id));
  if (same.every((row) => row !== undefined)) {
    return same.flatMap((row) => (row === undefined ? [] : [row]));
  }
  return phase === 'waiting' ? [primary] : eligible;
};
