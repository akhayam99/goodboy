import type { MountId, SessionId } from '@goodboy/types';
import type { RebaseStopRow } from '../../../history/rebaseStopRowOf';
import type { RebaseSuggestionTarget } from '../../../suggestions/types';
import type { ActionCardModel } from './actionCardsOf';
import type { NextGroupModel } from './nextGroupsOf';

export type NextBulk =
  | Readonly<{ kind: 'retry'; label: string; cards: ReadonlyArray<ActionCardModel> }>
  | Readonly<{
      kind: 'rebase';
      label: string;
      sessionId: SessionId;
      targets: ReadonlyArray<RebaseSuggestionTarget>;
    }>
  | Readonly<{
      kind: 'update';
      label: string;
      sessionId: SessionId;
      rebaseMountIds: ReadonlyArray<MountId>;
      bringInMountIds: ReadonlyArray<MountId>;
    }>;

type StopRowParams = {
  readonly mountId: string | null;
};

type Params = {
  readonly group: NextGroupModel;
  readonly sessionId?: SessionId;
  readonly stopRowFor?: (params: StopRowParams) => RebaseStopRow | null;
};

type CardParams = {
  readonly card: ActionCardModel;
};

const MIN_BULK = 2;

const isRetryable = ({ card }: CardParams): boolean => {
  const { source } = card;
  return (
    source.kind === 'auto' &&
    source.target.canRetry &&
    source.target.kind !== 'approve' &&
    source.target.kind !== 'blocked'
  );
};

const behindTargetsOf = ({ card }: CardParams): ReadonlyArray<RebaseSuggestionTarget> => {
  const { source } = card;
  return source.kind === 'suggestion' && source.suggestion.kind === 'rebase-project'
    ? source.suggestion.payload.targets
    : [];
};

type UpdateParams = {
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly sessionId: SessionId;
  readonly stopRowFor: (params: StopRowParams) => RebaseStopRow | null;
};

const updateBulkOf = ({ cards, sessionId, stopRowFor }: UpdateParams): NextBulk | null => {
  const stops = cards.flatMap((card) => {
    if (card.kind !== 'rebase' || card.source.kind !== 'owner') {
      return [];
    }
    const row = stopRowFor({ mountId: card.mountId });
    return row === null ? [] : [row];
  });
  const bringIn = stops.filter((row) => row.verb === 'bring-in').map((row) => row.mountId);
  const rebased = [
    ...cards.flatMap((card) => behindTargetsOf({ card }).map((target) => target.mountId)),
    ...stops
      .filter((row) => row.verb === 'retry-rebase' || row.verb === 'resolve-auto')
      .map((row) => row.mountId),
  ];
  const rebaseMountIds = Array.from(new Set(rebased)).filter((id) => !bringIn.includes(id));
  const count = rebaseMountIds.length + bringIn.length;
  return count < MIN_BULK
    ? null
    : {
        kind: 'update',
        label: `Update all ${count}`,
        sessionId,
        rebaseMountIds,
        bringInMountIds: bringIn,
      };
};

export const nextBulkOf = ({ group, sessionId, stopRowFor }: Params): NextBulk | null => {
  const cards = group.rows.flatMap((row) => [row, ...row.folded]);
  if (group.id === 'fix') {
    const stuck = cards.filter((card) => isRetryable({ card }));
    return stuck.length < MIN_BULK
      ? null
      : { kind: 'retry', label: `Retry ${stuck.length}`, cards: stuck };
  }
  if (group.id !== 'update') {
    return null;
  }
  if (sessionId !== undefined && stopRowFor !== undefined) {
    return updateBulkOf({ cards, sessionId, stopRowFor });
  }
  for (const card of group.rows) {
    const { source } = card;
    if (
      source.kind === 'suggestion' &&
      source.suggestion.kind === 'rebase-project' &&
      source.suggestion.payload.targets.length >= MIN_BULK
    ) {
      return {
        kind: 'rebase',
        label: 'Rebase all',
        sessionId: source.suggestion.sessionId,
        targets: source.suggestion.payload.targets,
      };
    }
  }
  return null;
};
